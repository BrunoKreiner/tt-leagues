# PowerShell SQLite Commands

PowerShell doesn't support `<` for input redirection like bash. Here are PowerShell-compatible alternatives:

## Method 1: Using Get-Content and Pipe (Recommended)

```powershell
Get-Content database/add_indexes.sql | sqlite3 database/league.db
```

## Method 2: Using cat (if available)

```powershell
cat database/add_indexes.sql | sqlite3 database/league.db
```

## Method 3: Using type

```powershell
type database/add_indexes.sql | sqlite3 database/league.db
```

## Method 4: Read file and execute (More control)

```powershell
$sql = Get-Content database/add_indexes.sql -Raw
sqlite3 database/league.db $sql
```

## Quick Reference

| Task | Bash | PowerShell |
|------|------|------------|
| Run SQL file | `sqlite3 db.sqlite < file.sql` | `Get-Content file.sql \| sqlite3 db.sqlite` |
| Check indexes | `sqlite3 db.sqlite ".indices"` | `sqlite3 db.sqlite ".indices"` |
| Interactive mode | `sqlite3 db.sqlite` | `sqlite3 db.sqlite` |

