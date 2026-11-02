param([ValidateSet('간이보기','전체보기')][string]$View='간이보기', [switch]$OpenOnly)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$views = @{
    '간이보기' = Join-Path $PSScriptRoot '간이보기'
    '전체보기' = Join-Path $PSScriptRoot '전체보기'
}
$script:currentView = $View
$script:explorerWindow = $null
function Show-WorkView([string]$viewName) {
    $target = $views[$viewName]
    if (-not (Test-Path -LiteralPath $target -PathType Container)) { throw "보기 폴더가 없습니다: $target" }
    $navigated = $false
    if ($script:explorerWindow) {
        try { $script:explorerWindow.Navigate2($target); $navigated = $true } catch { $script:explorerWindow = $null }
    }
    if (-not $navigated) {
        $shell = New-Object -ComObject Shell.Application
        foreach ($window in $shell.Windows()) {
            try {
                if ($window.FullName -notlike '*\explorer.exe') { continue }
                $windowPath = ([uri]$window.LocationURL).LocalPath.TrimEnd('\')
                if ($views.Values -contains $windowPath) {
                    $window.Navigate2($target)
                    $script:explorerWindow = $window
                    $navigated = $true
                    break
                }
            } catch { }
        }
    }
    if (-not $navigated) { Start-Process -FilePath explorer.exe -ArgumentList ('"' + $target + '"') }
    $script:currentView = $viewName
    if ($script:stateLabel) { $script:stateLabel.Text = "현재: $viewName  |  파일 작업은 Windows 탐색기에서 합니다." }
    if ($script:simpleButton) {
        $script:simpleButton.BackColor = if ($viewName -eq '간이보기') { [Drawing.Color]::FromArgb(40,85,128) } else { [Drawing.Color]::White }
        $script:simpleButton.ForeColor = if ($viewName -eq '간이보기') { [Drawing.Color]::White } else { [Drawing.Color]::FromArgb(40,55,72) }
        $script:fullButton.BackColor = if ($viewName -eq '전체보기') { [Drawing.Color]::FromArgb(40,85,128) } else { [Drawing.Color]::White }
        $script:fullButton.ForeColor = if ($viewName -eq '전체보기') { [Drawing.Color]::White } else { [Drawing.Color]::FromArgb(40,55,72) }
    }
}
if ($OpenOnly) { Show-WorkView $View; exit }
$form = New-Object Windows.Forms.Form
$form.Text = 'Codex 업무 탐색기 · 보기 전환'
$form.ClientSize = New-Object Drawing.Size(500,185)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.BackColor = [Drawing.Color]::FromArgb(244,247,251)
$form.Font = New-Object Drawing.Font('Malgun Gothic',9)
$title = New-Object Windows.Forms.Label
$title.Text = 'Codex 업무 탐색기'
$title.Font = New-Object Drawing.Font('Malgun Gothic',13,[Drawing.FontStyle]::Bold)
$title.SetBounds(22,15,450,30)
$form.Controls.Add($title)
$script:simpleButton = New-Object Windows.Forms.Button
$script:simpleButton.Text = "간이보기`r`n문서 · 사이트 · 실행 바로가기"
$script:simpleButton.SetBounds(22,54,222,65)
$script:simpleButton.FlatStyle = 'Flat'
$script:simpleButton.Add_Click({ Show-WorkView '간이보기' })
$form.Controls.Add($script:simpleButton)
$script:fullButton = New-Object Windows.Forms.Button
$script:fullButton.Text = "전체보기`r`n공통 작업 · 원본 · 결과물 폴더"
$script:fullButton.SetBounds(255,54,222,65)
$script:fullButton.FlatStyle = 'Flat'
$script:fullButton.Add_Click({ Show-WorkView '전체보기' })
$form.Controls.Add($script:fullButton)
$script:stateLabel = New-Object Windows.Forms.Label
$script:stateLabel.SetBounds(22,132,460,35)
$script:stateLabel.ForeColor = [Drawing.Color]::FromArgb(85,105,125)
$form.Controls.Add($script:stateLabel)
$form.Add_Shown({ Show-WorkView $View })
$visibleTimer = New-Object Windows.Forms.Timer
$visibleTimer.Interval = 300
$visibleTimer.Add_Tick({
    $visibleTimer.Stop()
    $form.Visible = $true
    $form.WindowState = 'Normal'
    $form.Activate()
})
$visibleTimer.Start()
[void]$form.ShowDialog()
