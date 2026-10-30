//! Programdan bagimsiz surec calistirici: her sureci kendi grubunda baslatir
//! (Unix: process group, Windows: Job Object), stdout/stderr satirlarini olay olarak
//! iletir ve iptalde tum grubu (orn. yt-dlp'nin baslattigi ffmpeg'leri) oldurur.

use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ProcessEvent {
    Stdout { line: String },
    Stderr { line: String },
    Exit { code: Option<i32>, killed: bool },
}

struct Entry {
    group: ProcessGroup,
    killed: Arc<AtomicBool>,
}

#[derive(Default)]
pub struct ProcessManager {
    next_id: AtomicU32,
    running: Arc<Mutex<HashMap<u32, Entry>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// Sureci baslatir ve kimligini dondurur. Olaylar ayri thread'lerden gelir;
    /// `Exit` her zaman en son ve tam bir kez gonderilir.
    pub fn spawn<F>(&self, program: &Path, args: &[String], on_event: F) -> Result<u32, String>
    where
        F: Fn(ProcessEvent) + Send + Sync + 'static,
    {
        let mut cmd = Command::new(program);
        cmd.args(args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        ProcessGroup::prepare(&mut cmd);

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("{} calistirilamadi: {e}", program.display()))?;
        let group = ProcessGroup::attach(&child)?;

        let id = self.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let killed = Arc::new(AtomicBool::new(false));
        self.running.lock().unwrap().insert(
            id,
            Entry {
                group,
                killed: killed.clone(),
            },
        );

        let on_event = Arc::new(on_event);
        let stdout = child.stdout.take().expect("stdout piped");
        let stderr = child.stderr.take().expect("stderr piped");
        let out_reader = forward_lines(stdout, on_event.clone(), |line| ProcessEvent::Stdout { line });
        let err_reader = forward_lines(stderr, on_event.clone(), |line| ProcessEvent::Stderr { line });
        let running = self.running.clone();

        std::thread::spawn(move || {
            // Akislar bitmeden Exit gonderilirse son satirlar Exit'ten sonra gelir.
            let _ = out_reader.join();
            let _ = err_reader.join();
            let code = child.wait().ok().and_then(|s| s.code());
            running.lock().unwrap().remove(&id);
            on_event(ProcessEvent::Exit {
                code,
                killed: killed.load(Ordering::SeqCst),
            });
        });

        Ok(id)
    }

    /// Uygulama kapanirken: Unix'te surec gruplari uygulamadan bagimsiz yasamaya devam ederdi
    /// (Windows'ta Job Object kapaninca zaten sonlanir).
    pub fn kill_all(&self) {
        for entry in self.running.lock().unwrap().values() {
            entry.killed.store(true, Ordering::SeqCst);
            entry.group.kill();
        }
    }

    /// Surecin tum grubunu oldurur; surec zaten bittiyse `false` doner.
    pub fn kill(&self, id: u32) -> bool {
        let running = self.running.lock().unwrap();
        match running.get(&id) {
            Some(entry) => {
                entry.killed.store(true, Ordering::SeqCst);
                entry.group.kill();
                true
            }
            None => false,
        }
    }
}

fn forward_lines<R, F>(stream: R, on_event: Arc<F>, wrap: fn(String) -> ProcessEvent) -> std::thread::JoinHandle<()>
where
    R: Read + Send + 'static,
    F: Fn(ProcessEvent) + Send + Sync + 'static,
{
    std::thread::spawn(move || {
        let mut reader = BufReader::new(stream);
        let mut buf = Vec::new();
        // Gecersiz UTF-8 (orn. Windows konsol kod sayfasi) satiri dusurmesin.
        while reader.read_until(b'\n', &mut buf).map(|n| n > 0).unwrap_or(false) {
            let line = String::from_utf8_lossy(&buf).trim_end_matches(['\r', '\n']).to_string();
            on_event(wrap(line));
            buf.clear();
        }
    })
}

#[cfg(unix)]
struct ProcessGroup {
    pgid: i32,
}

#[cfg(unix)]
impl ProcessGroup {
    fn prepare(cmd: &mut Command) {
        std::os::unix::process::CommandExt::process_group(cmd, 0);
    }

    fn attach(child: &std::process::Child) -> Result<Self, String> {
        Ok(Self {
            pgid: child.id() as i32,
        })
    }

    fn kill(&self) {
        unsafe {
            libc::killpg(self.pgid, libc::SIGKILL);
        }
    }
}

#[cfg(windows)]
struct ProcessGroup {
    job: windows_sys::Win32::Foundation::HANDLE,
}

// Job handle'i yalnizca kill ve Drop'ta kullanilir; Windows handle'lari thread'ler arasi gecerlidir.
#[cfg(windows)]
unsafe impl Send for ProcessGroup {}

#[cfg(windows)]
impl ProcessGroup {
    fn prepare(cmd: &mut Command) {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        std::os::windows::process::CommandExt::creation_flags(cmd, CREATE_NO_WINDOW);
    }

    /// Not: Surec job'a baslatildiktan hemen sonra eklenir; bu kisa aralikta
    /// olusturulan alt surecler job disinda kalabilir (yt-dlp ffmpeg'i cok daha sonra baslatir).
    fn attach(child: &std::process::Child) -> Result<Self, String> {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::Foundation::CloseHandle;
        use windows_sys::Win32::System::JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation, SetInformationJobObject,
            JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        };

        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() {
                return Err("Job Object olusturulamadi".to_string());
            }
            // Uygulama kapanirsa job handle'i kapanir ve gruptaki her sey sonlanir.
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            let ok = SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as *const _,
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            ) != 0
                && AssignProcessToJobObject(job, child.as_raw_handle() as _) != 0;
            if !ok {
                CloseHandle(job);
                return Err("Surec Job Object'e eklenemedi".to_string());
            }
            Ok(Self { job })
        }
    }

    fn kill(&self) {
        unsafe {
            windows_sys::Win32::System::JobObjects::TerminateJobObject(self.job, 1);
        }
    }
}

#[cfg(windows)]
impl Drop for ProcessGroup {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.job);
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    fn collect(manager: &ProcessManager, script: &str) -> (u32, mpsc::Receiver<ProcessEvent>) {
        let (tx, rx) = mpsc::channel();
        let tx = Mutex::new(tx);
        let id = manager
            .spawn(Path::new("sh"), &["-c".to_string(), script.to_string()], move |e| {
                let _ = tx.lock().unwrap().send(e);
            })
            .unwrap();
        (id, rx)
    }

    fn until_exit(rx: &mpsc::Receiver<ProcessEvent>) -> Vec<ProcessEvent> {
        let mut events = Vec::new();
        loop {
            let e = rx.recv_timeout(Duration::from_secs(10)).expect("Exit bekleniyordu");
            let done = matches!(e, ProcessEvent::Exit { .. });
            events.push(e);
            if done {
                return events;
            }
        }
    }

    #[test]
    fn streams_lines_then_exit_code() {
        let manager = ProcessManager::new();
        let (_, rx) = collect(&manager, "echo bir; echo iki >&2; printf 'uc\\r\\n'; exit 3");
        let events = until_exit(&rx);
        let mut stdout: Vec<&ProcessEvent> = events
            .iter()
            .filter(|e| matches!(e, ProcessEvent::Stdout { .. }))
            .collect();
        stdout.sort_by_key(|e| format!("{e:?}"));
        assert_eq!(
            stdout,
            [
                &ProcessEvent::Stdout { line: "bir".into() },
                &ProcessEvent::Stdout { line: "uc".into() },
            ]
        );
        assert!(events.contains(&ProcessEvent::Stderr { line: "iki".into() }));
        assert_eq!(
            events.last(),
            Some(&ProcessEvent::Exit {
                code: Some(3),
                killed: false
            })
        );
    }

    #[test]
    fn kill_terminates_whole_group() {
        let manager = ProcessManager::new();
        // Arka plandaki torun surec PID'ini yazar; grup oldurulunce o da olmeli.
        let (id, rx) = collect(&manager, "sleep 30 & echo $!; wait");
        let grandchild: i32 = match rx.recv_timeout(Duration::from_secs(5)).unwrap() {
            ProcessEvent::Stdout { line } => line.parse().unwrap(),
            other => panic!("beklenmeyen olay: {other:?}"),
        };

        assert!(manager.kill(id));
        let events = until_exit(&rx);
        assert_eq!(
            events.last(),
            Some(&ProcessEvent::Exit {
                code: None,
                killed: true
            })
        );

        // Oldurulen torun kisa sure zombi kalabilir; ust surec onu toplayana kadar bekle.
        let gone = (0..100).any(|_| {
            if unsafe { libc::kill(grandchild, 0) } != 0 {
                return true;
            }
            std::thread::sleep(Duration::from_millis(10));
            false
        });
        assert!(gone, "torun surec hala calisiyor");
        assert!(!manager.kill(id), "biten surec tekrar oldurulemez");
    }

    #[test]
    fn kill_all_stops_every_running_process() {
        let manager = ProcessManager::new();
        let (_, first) = collect(&manager, "sleep 30");
        let (_, second) = collect(&manager, "sleep 30");

        manager.kill_all();
        for rx in [first, second] {
            let events = until_exit(&rx);
            assert_eq!(
                events.last(),
                Some(&ProcessEvent::Exit {
                    code: None,
                    killed: true
                })
            );
        }
    }

    #[test]
    fn missing_program_is_an_error() {
        let manager = ProcessManager::new();
        assert!(manager.spawn(Path::new("/yok/boyle-bir-program"), &[], |_| {}).is_err());
    }
}

#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    fn collect(manager: &ProcessManager, program: &str, args: &[&str]) -> (u32, mpsc::Receiver<ProcessEvent>) {
        let (tx, rx) = mpsc::channel();
        let tx = Mutex::new(tx);
        let args: Vec<String> = args.iter().map(|a| a.to_string()).collect();
        let id = manager
            .spawn(Path::new(program), &args, move |e| {
                let _ = tx.lock().unwrap().send(e);
            })
            .unwrap();
        (id, rx)
    }

    fn until_exit(rx: &mpsc::Receiver<ProcessEvent>) -> Vec<ProcessEvent> {
        let mut events = Vec::new();
        loop {
            let e = rx.recv_timeout(Duration::from_secs(30)).expect("Exit bekleniyordu");
            let done = matches!(e, ProcessEvent::Exit { .. });
            events.push(e);
            if done {
                return events;
            }
        }
    }

    fn is_running(pid: u32) -> bool {
        let out = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}"), "/NH"])
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout).contains(&pid.to_string())
    }

    #[test]
    fn streams_lines_then_exit_code() {
        let manager = ProcessManager::new();
        let (_, rx) = collect(&manager, "cmd", &["/C", "(echo bir)& (echo iki)1>&2& exit /b 3"]);
        let events = until_exit(&rx);
        assert!(events.contains(&ProcessEvent::Stdout { line: "bir".into() }));
        assert!(events.contains(&ProcessEvent::Stderr { line: "iki".into() }));
        assert_eq!(
            events.last(),
            Some(&ProcessEvent::Exit {
                code: Some(3),
                killed: false
            })
        );
    }

    #[test]
    fn kill_terminates_whole_job() {
        let manager = ProcessManager::new();
        // Torun surec (ping) job'a otomatik dahil olur; job sonlaninca o da olmeli.
        let script = "$p = Start-Process -FilePath ping.exe -ArgumentList '-n','60','127.0.0.1' -PassThru -WindowStyle Hidden; Write-Output $p.Id; Wait-Process -Id $p.Id";
        let (id, rx) = collect(
            &manager,
            "powershell",
            &["-NoProfile", "-NonInteractive", "-Command", script],
        );
        let grandchild: u32 = loop {
            // Windows CI'da PowerShell'in ilk acilisi 30 sn'yi asabiliyor.
            match rx.recv_timeout(Duration::from_secs(120)).unwrap() {
                ProcessEvent::Stdout { line } if !line.trim().is_empty() => break line.trim().parse().unwrap(),
                _ => continue,
            }
        };
        assert!(is_running(grandchild));

        assert!(manager.kill(id));
        let events = until_exit(&rx);
        assert!(matches!(events.last(), Some(ProcessEvent::Exit { killed: true, .. })));

        let gone = (0..50).any(|_| {
            if !is_running(grandchild) {
                return true;
            }
            std::thread::sleep(Duration::from_millis(100));
            false
        });
        assert!(gone, "torun surec hala calisiyor");
    }

    #[test]
    fn missing_program_is_an_error() {
        let manager = ProcessManager::new();
        assert!(manager
            .spawn(Path::new("C:\\yok\\boyle-bir-program.exe"), &[], |_| {})
            .is_err());
    }
}
