[CmdletBinding()]
param(
    [string]$WorkbookDirectory = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($WorkbookDirectory)) {
    $WorkbookDirectory = Join-Path $PSScriptRoot "..\..\apps\web\public\downloads"
}

function Invoke-ComRetry {
    param(
        [Parameter(Mandatory)]
        [scriptblock]$Operation,
        [int]$Attempts = 80
    )

    for ($attempt = 0; $attempt -lt $Attempts; $attempt++) {
        try {
            return & $Operation
        }
        catch [System.Runtime.InteropServices.COMException] {
            if ($_.Exception.HResult -ne -2147418111) {
                throw
            }
            Start-Sleep -Milliseconds 250
        }
    }
    throw "Microsoft Excel remained busy after $Attempts attempts."
}

function Get-ExcelColumnName {
    param([int]$Column)

    $name = ""
    while ($Column -gt 0) {
        $Column--
        $name = [char](65 + ($Column % 26)) + $name
        $Column = [math]::Floor($Column / 26)
    }
    return $name
}

function Get-CellSnapshot {
    param(
        [Parameter(Mandatory)]$Worksheet,
        [Parameter(Mandatory)][string]$Address
    )

    $range = Invoke-ComRetry { $Worksheet.Range($Address) }
    try {
        return [PSCustomObject]@{
            Address = $Address
            Formula = [string](Invoke-ComRetry { $range.Formula })
            Text = [string](Invoke-ComRetry { $range.Text })
            Value = Invoke-ComRetry { $range.Value2 }
        }
    }
    finally {
        [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($range)
    }
}

function Invoke-FullCalculation {
    param([Parameter(Mandatory)]$Excel)

    Invoke-ComRetry { $Excel.CalculateFullRebuild() }
    for ($attempt = 0; $attempt -lt 120; $attempt++) {
        if ((Invoke-ComRetry { $Excel.CalculationState }) -eq 0) {
            return
        }
        Start-Sleep -Milliseconds 250
    }
    throw "Excel calculation did not finish."
}

$workbookFiles = @(Get-ChildItem -LiteralPath $WorkbookDirectory -Filter "*.xlsx")
if ($workbookFiles.Count -ne 4) {
    throw "Expected four generated workbooks in $WorkbookDirectory; found $($workbookFiles.Count)."
}

$failures = [System.Collections.Generic.List[string]]::new()
$results = [System.Collections.Generic.List[object]]::new()

foreach ($file in $workbookFiles) {
    $copyPath = Join-Path $env:TEMP (
        "cfo-model-validation-{0}-{1}" -f [guid]::NewGuid(), $file.Name
    )
    Copy-Item -LiteralPath $file.FullName -Destination $copyPath

    $excel = $null
    $workbook = $null
    $assumptionsSheet = $null
    $cashSheet = $null
    $checksSheet = $null
    try {
        $excel = New-Object -ComObject Excel.Application
        $excel.Visible = $false
        $excel.DisplayAlerts = $false
        $workbook = Invoke-ComRetry { $excel.Workbooks.Open($copyPath) }
        Start-Sleep -Milliseconds 500

        $assumptionsSheet = Invoke-ComRetry {
            $workbook.Worksheets.Item("Assumptions")
        }
        $cashSheet = Invoke-ComRetry {
            $workbook.Worksheets.Item("Cash & Runway")
        }
        $checksSheet = Invoke-ComRetry {
            $workbook.Worksheets.Item("Checks")
        }

        foreach ($scenario in @("Base", "Upside", "Downside")) {
            $selector = Invoke-ComRetry { $assumptionsSheet.Range("C4") }
            try {
                Invoke-ComRetry { $selector.Value2 = $scenario }
            }
            finally {
                [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($selector)
            }
            Invoke-FullCalculation $excel

            for ($column = 3; $column -le 38; $column++) {
                $columnName = Get-ExcelColumnName $column
                $endingCash = Get-CellSnapshot $cashSheet "${columnName}8"
                $burn = Get-CellSnapshot $cashSheet "${columnName}9"
                $averageBurn = Get-CellSnapshot $cashSheet "${columnName}10"
                $runway = Get-CellSnapshot $cashSheet "${columnName}11"

                foreach ($snapshot in @($endingCash, $burn, $averageBurn, $runway)) {
                    if (
                        [string]::IsNullOrWhiteSpace($snapshot.Text) -or
                        $snapshot.Text.StartsWith("#")
                    ) {
                        $failures.Add(
                            "$($file.Name)/${scenario}: $($snapshot.Address) did not " +
                            "calculate ($($snapshot.Text))."
                        )
                    }
                }

                $cashValue = [double]$endingCash.Value
                $burnValue = [double]$averageBurn.Value
                $runwayValue = [double]$runway.Value
                $expectedRunway = if ($cashValue -le 0) {
                    0
                }
                elseif ($burnValue -le 0) {
                    999
                }
                else {
                    $cashValue / $burnValue
                }
                if ([math]::Abs($runwayValue - $expectedRunway) -gt 0.01) {
                    $failures.Add(
                        "$($file.Name)/${scenario}: ${columnName}11 runway $runwayValue " +
                        "does not equal ending cash $cashValue / trailing burn $burnValue " +
                        "(expected $expectedRunway)."
                    )
                }
                if (
                    $runway.Formula -notmatch (
                        [regex]::Escape("${columnName}8") + ".*" +
                        [regex]::Escape("${columnName}10")
                    )
                ) {
                    $failures.Add(
                        "$($file.Name)/${scenario}: ${columnName}11 does not reference " +
                        "populated cash and burn rows."
                    )
                }
            }

            for ($row = 5; $row -le 10; $row++) {
                $status = Get-CellSnapshot $checksSheet "D$row"
                if ($status.Text -ne "PASS") {
                    $failures.Add(
                        "$($file.Name)/${scenario}: Checks!D$row returned " +
                        "'$($status.Text)' instead of PASS."
                    )
                }
            }
            $overall = Get-CellSnapshot $checksSheet "D12"
            if ($overall.Text -ne "ALL PASS") {
                $failures.Add(
                    "$($file.Name)/${scenario}: Checks!D12 returned " +
                    "'$($overall.Text)' instead of ALL PASS."
                )
            }

            $firstRunway = Get-CellSnapshot $cashSheet "C11"
            $finalRunway = Get-CellSnapshot $cashSheet "AL11"
            $results.Add(
                [PSCustomObject]@{
                    Model = $file.Name
                    Scenario = $scenario
                    FirstMonthRunway = $firstRunway.Text
                    FinalMonthRunway = $finalRunway.Text
                    Checks = $overall.Text
                }
            )
        }
    }
    finally {
        if ($checksSheet) {
            [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($checksSheet)
        }
        if ($cashSheet) {
            [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($cashSheet)
        }
        if ($assumptionsSheet) {
            [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($assumptionsSheet)
        }
        if ($workbook) {
            Invoke-ComRetry { $workbook.Close($false) }
            [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($workbook)
        }
        if ($excel) {
            Invoke-ComRetry { $excel.Quit() }
            [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel)
        }
        Remove-Item -LiteralPath $copyPath -Force -ErrorAction SilentlyContinue
    }
}

$results | Format-Table -AutoSize

if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Error $_ }
    throw "$($failures.Count) Microsoft Excel calculation checks failed."
}

Write-Output "All four workbooks recalculated successfully in Microsoft Excel."
