//! Shared installer for downstream releases of an E7 Tools user-data snapshot.
//! E7 Tools remains the source; it does not install this snapshot over itself.
use std::{fs, io, path::Path};

pub const REVISION: &str = "2026-10-19-e7-tools-aliases-presets-2";
const ALIASES: &str = include_str!("../seed-data/aliases.json");
const BUILDS: &str = include_str!("../seed-data/build-presets.json");

pub fn install(dir: &Path) -> Result<bool, String> {
    install_inner(dir).map_err(|error| format!("Cannot synchronize aliases and equipment presets: {error}"))
}

fn install_inner(dir: &Path) -> io::Result<bool> {
    fs::create_dir_all(dir)?;
    let marker = dir.join(".user-data-seed");
    if fs::read_to_string(&marker).ok().as_deref() == Some(REVISION) {
        return Ok(false);
    }
    let files = [("aliases.json", ALIASES), ("build-presets.json", BUILDS)];
    // Back up every existing input before changing either file. Preserve the
    // original backups if an interrupted installation is retried.
    for (name, _) in files {
        let source = dir.join(name);
        if source.exists() {
            let backup_dir = dir.join(".seed-backups").join(REVISION);
            fs::create_dir_all(&backup_dir)?;
            let backup = backup_dir.join(name);
            if !backup.exists() {
                fs::copy(&source, &backup)?;
            }
        }
    }
    for (name, contents) in files {
        write_atomic(dir, name, contents)?;
    }
    write_atomic(dir, ".user-data-seed", REVISION)?;
    Ok(true)
}

fn write_atomic(dir: &Path, name: &str, contents: &str) -> io::Result<()> {
    let temporary = dir.join(format!("{name}.seed-tmp"));
    fs::write(&temporary, contents)?;
    fs::rename(temporary, dir.join(name))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

    fn fixture(name: &str) -> PathBuf {
        let root = std::env::var_os("E7_SEED_TEST_ROOT").map(PathBuf::from).unwrap_or_else(std::env::temp_dir);
        let unique = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let dir = root.join(format!("e7-seed-{name}-{}-{unique}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn installs_the_source_snapshot_for_a_new_user() {
        let dir = fixture("fresh");
        assert!(install(&dir).unwrap());
        assert_eq!(fs::read_to_string(dir.join("aliases.json")).unwrap(), ALIASES);
        assert_eq!(fs::read_to_string(dir.join("build-presets.json")).unwrap(), BUILDS);
        assert_eq!(fs::read_to_string(dir.join(".user-data-seed")).unwrap(), REVISION);
    }

    #[test]
    fn upgrades_existing_files_with_backups_and_preserves_calculator_profiles() {
        let dir = fixture("upgrade");
        fs::write(dir.join("aliases.json"), "old aliases").unwrap();
        fs::write(dir.join("build-presets.json"), "old presets").unwrap();
        fs::write(dir.join("profiles.json"), "manual calculator values").unwrap();
        fs::write(dir.join(".user-data-seed"), "old-revision").unwrap();
        assert!(install(&dir).unwrap());
        let backup = dir.join(".seed-backups").join(REVISION);
        assert_eq!(fs::read_to_string(backup.join("aliases.json")).unwrap(), "old aliases");
        assert_eq!(fs::read_to_string(backup.join("build-presets.json")).unwrap(), "old presets");
        assert_eq!(fs::read_to_string(dir.join("profiles.json")).unwrap(), "manual calculator values");
        assert_eq!(fs::read_to_string(dir.join("build-presets.json")).unwrap(), BUILDS);
    }

    #[test]
    fn does_not_reset_edits_after_the_first_successful_sync() {
        let dir = fixture("once");
        install(&dir).unwrap();
        fs::write(dir.join("aliases.json"), "edited later").unwrap();
        fs::write(dir.join("build-presets.json"), "edited equipment later").unwrap();
        assert!(!install(&dir).unwrap());
        assert_eq!(fs::read_to_string(dir.join("aliases.json")).unwrap(), "edited later");
        assert_eq!(fs::read_to_string(dir.join("build-presets.json")).unwrap(), "edited equipment later");
    }

    #[test]
    fn a_backup_failure_does_not_replace_the_other_file_or_mark_sync_complete() {
        let dir = fixture("failure");
        fs::write(dir.join("aliases.json"), "keep aliases").unwrap();
        fs::create_dir(dir.join("build-presets.json")).unwrap();
        assert!(install(&dir).is_err());
        assert_eq!(fs::read_to_string(dir.join("aliases.json")).unwrap(), "keep aliases");
        assert!(!dir.join(".user-data-seed").exists());
    }
}
