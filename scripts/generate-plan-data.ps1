param(
  [string]$PlanPath = (Join-Path $PSScriptRoot '..\PLAN DEFINITIVO 2026.md'),
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\app\plan-data.json')
)

$ErrorActionPreference = 'Stop'
$monthNumbers = @{
  'ene' = 1; 'feb' = 2; 'mar' = 3; 'abr' = 4; 'may' = 5; 'jun' = 6
  'jul' = 7; 'ago' = 8; 'sep' = 9; 'oct' = 10; 'nov' = 11; 'dic' = 12
}

function Remove-Markdown([string]$Value) {
  return ($Value -replace '\*\*', '' -replace '`', '').Trim()
}

function Get-AppCategory([string]$Value) {
  switch -Regex ($Value) {
    '^Descanso$' { return 'Descanso' }
    '^Series$' { return 'Series' }
    '^Fartlek$' { return 'Fartlek' }
    '^Tempo / controlado$' { return 'Fartlek' }
    '^Rodaje suave' { return 'Rodaje' }
    '^Ritmo espec.fico / Tirada larga si 14 km$' { return 'Tirada larga' }
    '^Ritmo espec.fico$' { return 'Rodaje' }
    '^Tirada larga$' { return 'Tirada larga' }
    '^Regenerativo' { return 'Regenerativo' }
    '^Fuerza' { return 'Fuerza' }
    '^Activaci.n$' { return $Value }
    '^Carrera$' { return 'Carrera' }
    default { throw "Tipo de entrenamiento sin clasificar: $Value" }
  }
}

function Get-WeekRange([string]$Label) {
  $match = [regex]::Match($Label, '^(\d{1,2})(?:\s+([a-záéíóú]{3}))?-(\d{1,2})\s+([a-záéíóú]{3})$')
  if (-not $match.Success) { throw "No se puede interpretar el rango semanal: $Label" }

  $startDay = [int]$match.Groups[1].Value
  $endDay = [int]$match.Groups[3].Value
  $endMonthName = $match.Groups[4].Value.ToLowerInvariant()
  $startMonthName = if ($match.Groups[2].Success) { $match.Groups[2].Value.ToLowerInvariant() } else { $endMonthName }
  if (-not $monthNumbers.ContainsKey($startMonthName) -or -not $monthNumbers.ContainsKey($endMonthName)) { throw "Mes no reconocido en: $Label" }

  return [pscustomobject]@{
    StartDay = $startDay
    StartMonth = $monthNumbers[$startMonthName]
    EndDay = $endDay
    EndMonth = $monthNumbers[$endMonthName]
  }
}

function Format-IsoDate([int]$Day, [int]$Month) {
  return '{0:D4}-{1:D2}-{2:D2}' -f 2026, $Month, $Day
}

$block = ''
$week = ''
$weekTitle = ''
$weekRange = $null
$readingSessions = $false
$items = [System.Collections.Generic.List[object]]::new()

foreach ($line in Get-Content -LiteralPath $PlanPath -Encoding utf8) {
  if ($line -match '^# (BLOQUE .+|VACACIONES)\s*$') {
    $block = $Matches[1].Trim()
    $readingSessions = $false
    continue
  }

  if ($line -match '^## (\d{1,2}(?:\s+[a-z]{3})?-\d{1,2}\s+[a-z]{3})\s+.+?\s+(.+?)\s*$') {
    $week = $Matches[1].Trim()
    $weekTitle = $Matches[2].Trim()
    $weekRange = Get-WeekRange $week
    $readingSessions = $false
    continue
  }

  if ($line -match '^\|\s+D.+?\|\s+Sesi.+?\|\s+Tipo\s+\|\s+Ritmo / esfuerzo\s+\|\s+Volumen\s+\|\s+Notas\s+\|$') {
    if (-not $block -or -not $weekRange) { throw "Tabla de sesiones sin bloque o semana: $line" }
    $readingSessions = $true
    continue
  }

  if (-not $readingSessions) { continue }
  if ($line -match '^\|[-|]+\|$') { continue }
  if (-not $line.StartsWith('|')) {
    $readingSessions = $false
    continue
  }

  $columns = $line.Trim().Trim('|').Split('|') | ForEach-Object { Remove-Markdown $_ }
  if ($columns.Count -ne 6) { throw "Fila de sesión con $($columns.Count) columnas: $line" }

  $dayLabel = $columns[0]
  if ($dayLabel -eq 'Todo el periodo') {
    $date = Format-IsoDate $weekRange.StartDay $weekRange.StartMonth
    $endDate = Format-IsoDate $weekRange.EndDay $weekRange.EndMonth
  } else {
    $dayMatch = [regex]::Match($dayLabel, '(\d{1,2})$')
    if (-not $dayMatch.Success) { throw "Día no reconocido: $dayLabel" }
    $dayNumber = [int]$dayMatch.Groups[1].Value
    $month = if ($weekRange.StartMonth -ne $weekRange.EndMonth -and $dayNumber -lt $weekRange.StartDay) { $weekRange.EndMonth } else { $weekRange.StartMonth }
    $date = Format-IsoDate $dayNumber $month
    $endDate = $null
  }

  $position = $items.Count + 1
  $items.Add([ordered]@{
    id = "session-$date-$position"
    date = $date
    endDate = $endDate
    block = $block
    week = $week
    weekTitle = $weekTitle
    day = $dayLabel
    category = Get-AppCategory $columns[2]
    session = $columns[1]
    pace = $columns[3]
    volume = $columns[4]
    notes = $columns[5]
  })
}

if ($items.Count -ne 86) { throw "Se esperaban 86 entradas y se han generado $($items.Count). Revisa el Markdown." }

$json = ($items | ConvertTo-Json -Depth 4) -replace "`r`n", "`n"
[System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath($OutputPath), $json + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Output "Generadas $($items.Count) entradas en $([System.IO.Path]::GetFullPath($OutputPath))"
