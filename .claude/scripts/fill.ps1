param([string]$title, [int]$x, [int]$y, [string]$text)
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class U {
  public delegate bool EW(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EW cb, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, UIntPtr e);
}
"@
$script:found = [IntPtr]::Zero
[U]::EnumWindows({ param($h, $l)
  $sb = New-Object System.Text.StringBuilder 512
  [U]::GetWindowText($h, $sb, 512) | Out-Null
  if ([U]::IsWindowVisible($h) -and $sb.ToString() -like "*$title*" -and $sb.ToString() -notlike "*Visual Studio Code*") { $script:found = $h; return $false }
  return $true }, [IntPtr]::Zero) | Out-Null
if ($script:found -eq [IntPtr]::Zero) { "no window"; exit 1 }
[U]::ShowWindow($script:found, 3) | Out-Null
(New-Object -ComObject WScript.Shell).AppActivate($title) | Out-Null
[U]::SetForegroundWindow($script:found) | Out-Null
Start-Sleep -Milliseconds 900
[U]::SetCursorPos($x, $y) | Out-Null; Start-Sleep -Milliseconds 100
[U]::mouse_event(2,0,0,0,[UIntPtr]::Zero); [U]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait("^a"); Start-Sleep -Milliseconds 200
Set-Clipboard -Value $text; Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait("^v"); Start-Sleep -Milliseconds 400
[System.Windows.Forms.SendKeys]::SendWait("{TAB}"); Start-Sleep -Milliseconds 300
"done"
