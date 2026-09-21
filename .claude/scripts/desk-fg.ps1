# Imprime o título da janela que está na frente agora (pra travar ações de
# teclado/mouse do desk.ps1 quando a janela errada — ex: VS Code — roubou o foco).
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class FG {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
}
"@
$sb = New-Object System.Text.StringBuilder 512
[void][FG]::GetWindowText([FG]::GetForegroundWindow(), $sb, 512)
Write-Output $sb.ToString()
