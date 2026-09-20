param(
  [Parameter(Position=0)][string]$cmd,
  [Parameter(Position=1)][string]$a1,
  [Parameter(Position=2)][string]$a2,
  [Parameter(Position=3)][string]$a3
)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public class W {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, int d, UIntPtr e);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  public static List<IntPtr> Handles = new List<IntPtr>();
  public static List<string> Titles = new List<string>();
  public static void Scan() {
    Handles.Clear(); Titles.Clear();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (IsWindowVisible(h)) {
        StringBuilder sb = new StringBuilder(256);
        GetWindowText(h, sb, 256);
        if (sb.Length > 0) { Handles.Add(h); Titles.Add(sb.ToString()); }
      }
      return true;
    }, IntPtr.Zero);
  }
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr h, bool alt);
  public static void Top(IntPtr h, bool on) {
    if (IsIconic(h)) ShowWindow(h, 9);
    SetWindowPos(h, new IntPtr(on ? -1 : -2), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040);
    if (on) SwitchToThisWindow(h, true);
  }
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public static void Focus(IntPtr h) {
    keybd_event(0x12, 0, 0, UIntPtr.Zero);
    keybd_event(0x12, 0, 2, UIntPtr.Zero);
    if (IsIconic(h)) ShowWindow(h, 9);
    IntPtr fg = GetForegroundWindow();
    uint pid;
    uint fgThread = GetWindowThreadProcessId(fg, out pid);
    uint me = GetCurrentThreadId();
    AttachThreadInput(me, fgThread, true);
    SetForegroundWindow(h);
    AttachThreadInput(me, fgThread, false);
  }
}
"@

$scratch = Join-Path $env:TEMP "desk-shots"
if (-not (Test-Path $scratch)) { New-Item -ItemType Directory -Path $scratch | Out-Null }

function Shot([string]$path) {
  if (-not $path) { $path = Join-Path $scratch "desk.png" }
  $b = [System.Windows.Forms.SystemInformation]::PrimaryMonitorSize
  $bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
  if ($env:DESK_CROP) {
    $c = $env:DESK_CROP -split ','
    $rect = New-Object System.Drawing.Rectangle ([int]$c[0]), ([int]$c[1]), ([int]$c[2]), ([int]$c[3])
    $crop = $bmp.Clone($rect, $bmp.PixelFormat)
    $bmp.Dispose(); $bmp = $crop
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output $path
}

switch ($cmd) {
  "list" {
    [W]::Scan()
    for ($i = 0; $i -lt [W]::Titles.Count; $i++) { Write-Output ("{0} | {1}" -f $i, [W]::Titles[$i]) }
  }
  "focus" {
    [W]::Scan()
    $found = $false
    for ($i = 0; $i -lt [W]::Titles.Count; $i++) {
      if ([W]::Titles[$i] -like "*$a1*") { [W]::Focus([W]::Handles[$i]); if ($a2 -eq "max") { [W]::ShowWindow([W]::Handles[$i], 3) | Out-Null }; Write-Output ("focused: " + [W]::Titles[$i]); $found = $true; break }
    }
    if (-not $found) { Write-Output "no window matching: $a1" }
  }
  "act" {
    [W]::Scan()
    $vs = -1; $tg = -1
    for ($i = 0; $i -lt [W]::Titles.Count; $i++) {
      if ($vs -lt 0 -and [W]::Titles[$i] -like "*Visual Studio Code*") { $vs = $i }
      if ($tg -lt 0 -and [W]::Titles[$i] -like "*$a1*" -and [W]::Titles[$i] -notlike "*Visual Studio Code*") { $tg = $i }
    }
    if ($tg -lt 0) { Write-Output "no window matching: $a1"; return }
    [W]::Top([W]::Handles[$tg], $true)
    [W]::ShowWindow([W]::Handles[$tg], 3) | Out-Null
    Start-Sleep -Milliseconds 800
    try { (New-Object -ComObject WScript.Shell).AppActivate([W]::Titles[$tg]) | Out-Null } catch {}
    [W]::Focus([W]::Handles[$tg])
    Start-Sleep -Milliseconds 900
    $parts = $a2 -split ' '
    switch ($parts[0]) {
      "click" {
        [W]::SetCursorPos([int]$parts[1], [int]$parts[2]) | Out-Null
        Start-Sleep -Milliseconds 80
        if ($parts[3] -eq "right") { [W]::mouse_event(0x8,0,0,0,[UIntPtr]::Zero); [W]::mouse_event(0x10,0,0,0,[UIntPtr]::Zero) }
        else { [W]::mouse_event(0x2,0,0,0,[UIntPtr]::Zero); [W]::mouse_event(0x4,0,0,0,[UIntPtr]::Zero) }
      }
      "key" { [System.Windows.Forms.SendKeys]::SendWait($a2.Substring(4)) }
      "type" { Set-Clipboard -Value ($a2.Substring(5)); Start-Sleep -Milliseconds 100; [System.Windows.Forms.SendKeys]::SendWait("^v") }
      "scroll" {
        if ($parts.Length -ge 4) { [W]::SetCursorPos([int]$parts[2], [int]$parts[3]) | Out-Null; Start-Sleep -Milliseconds 150 }
        [W]::mouse_event(0x800,0,0,[int]$parts[1],[UIntPtr]::Zero)
      }
      "clicks" {
        foreach ($p in $parts[1..($parts.Length - 1)]) {
          $xy = $p -split ','
          [W]::SetCursorPos([int]$xy[0], [int]$xy[1]) | Out-Null
          Start-Sleep -Milliseconds 120
          [W]::mouse_event(0x2,0,0,0,[UIntPtr]::Zero); [W]::mouse_event(0x4,0,0,0,[UIntPtr]::Zero)
          Start-Sleep -Milliseconds 1100
        }
      }
    }
    $wait = 3000; if ($a3) { $wait = [int]$a3 }
    Start-Sleep -Milliseconds $wait
    Shot ""
    [W]::Top([W]::Handles[$tg], $false)
  }
  "minimize" {
    [W]::Scan()
    for ($i = 0; $i -lt [W]::Titles.Count; $i++) {
      if ([W]::Titles[$i] -like "*$a1*") { [W]::ShowWindow([W]::Handles[$i], 6) | Out-Null; Write-Output ("minimized: " + [W]::Titles[$i]); break }
    }
  }
  "shot" { Shot $a1 }
  "click" {
    [W]::SetCursorPos([int]$a1, [int]$a2) | Out-Null
    Start-Sleep -Milliseconds 80
    if ($a3 -eq "right") { [W]::mouse_event(0x8,0,0,0,[UIntPtr]::Zero); [W]::mouse_event(0x10,0,0,0,[UIntPtr]::Zero) }
    else {
      $n = 1; if ($a3 -eq "double") { $n = 2 }
      for ($k = 0; $k -lt $n; $k++) { [W]::mouse_event(0x2,0,0,0,[UIntPtr]::Zero); [W]::mouse_event(0x4,0,0,0,[UIntPtr]::Zero); Start-Sleep -Milliseconds 60 }
    }
    Write-Output "clicked $a1,$a2 $a3"
  }
  "type" {
    Set-Clipboard -Value $a1
    Start-Sleep -Milliseconds 100
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Write-Output "typed"
  }
  "key" {
    [System.Windows.Forms.SendKeys]::SendWait($a1)
    Write-Output "key $a1"
  }
  "scroll" {
    [W]::mouse_event(0x800,0,0,[int]$a1,[UIntPtr]::Zero)
    Write-Output "scrolled $a1"
  }
  default { Write-Output "commands: list | focus <title> | shot [path] | click x y [right|double] | type <text> | key <sendkeys> | scroll <delta>" }
}
