# Top-level window probe for the Windows native baseline (see docs/pilaude-windows-regression.md).
#
#   -Action list   (default) JSON array of the target process's visible top-level windows
#                  (geometry, DPI, frame styles; PrintWindow capture when -CaptureDirectory is set)
#   -Action move   -Handle <h> -X <x> -Y <y>   SetWindowPos (position only), prints the moved window row
#   -Action close  -Handle <h>                 posts WM_CLOSE, prints [{handle, posted}]
#   -Action dpi    system and primary-monitor DPI (no target process needed)
#
# Exit codes: 0 ok (an empty array is ok), 3 target process missing, 4 capture directory unusable,
# 5 bad arguments / window does not belong to the target process.
param(
  [int]$TargetProcessId = 0,
  [ValidateSet('list', 'move', 'close', 'dpi')][string]$Action = 'list',
  [string]$CaptureDirectory = '',
  [Int64]$Handle = 0,
  [int]$X = 0,
  [int]$Y = 0
)
$ErrorActionPreference = 'Stop'

function Fail([int]$code, [string]$message) {
  [Console]::Error.WriteLine($message)
  exit $code
}

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;

public static class PilaudeWindowProbe {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr lParam);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int count);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr hwnd, int index);
  [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);
  [DllImport("user32.dll")] static extern uint GetDpiForSystem();
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint flags);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromPoint(Point point, uint flags);
  [DllImport("shcore.dll")] static extern int GetDpiForMonitor(IntPtr monitor, int type, out uint x, out uint y);
  [DllImport("shcore.dll")] static extern int GetScaleFactorForMonitor(IntPtr monitor, out int scale);

  public static void EnablePerMonitorV2() { SetProcessDpiAwarenessContext(new IntPtr(-4)); }

  public static IntPtr[] Find(int processId) {
    List<IntPtr> handles = new List<IntPtr>();
    EnumWindows(delegate (IntPtr handle, IntPtr value) {
      uint owner;
      GetWindowThreadProcessId(handle, out owner);
      if (owner == (uint)processId && IsWindowVisible(handle)) handles.Add(handle);
      return true;
    }, IntPtr.Zero);
    return handles.ToArray();
  }

  public static uint OwnerOf(IntPtr hwnd) { uint owner; GetWindowThreadProcessId(hwnd, out owner); return owner; }
  public static bool Move(IntPtr hwnd, int x, int y) { return SetWindowPos(hwnd, IntPtr.Zero, x, y, 0, 0, 0x0001 | 0x0004 | 0x0010); }
  public static bool Close(IntPtr hwnd) { return PostMessage(hwnd, 0x0010, IntPtr.Zero, IntPtr.Zero); }

  public static Dictionary<string, object> Describe(IntPtr hwnd) {
    Rect rect;
    GetWindowRect(hwnd, out rect);
    StringBuilder text = new StringBuilder(512);
    GetWindowText(hwnd, text, 512);
    long style = GetWindowLongPtr(hwnd, -16).ToInt64();
    IntPtr monitor = MonitorFromWindow(hwnd, 2);
    uint dpiX = 0, dpiY = 0;
    int scale = 0;
    GetDpiForMonitor(monitor, 0, out dpiX, out dpiY);
    GetScaleFactorForMonitor(monitor, out scale);
    Dictionary<string, object> row = new Dictionary<string, object>();
    row["handle"] = hwnd.ToInt64();
    row["title"] = text.ToString();
    row["processId"] = (long)OwnerOf(hwnd);
    row["x"] = rect.Left; row["y"] = rect.Top;
    row["width"] = rect.Right - rect.Left; row["height"] = rect.Bottom - rect.Top;
    row["dpi"] = (long)GetDpiForWindow(hwnd);
    row["monitorDpi"] = (long)dpiX;
    row["monitorScalePercent"] = (long)Math.Round(dpiX * 100.0 / 96.0);
    row["monitorScaleFactor"] = (long)scale;
    row["caption"] = (style & 0x00C00000L) == 0x00C00000L;
    row["systemMenu"] = (style & 0x00080000L) != 0;
    row["thickFrame"] = (style & 0x00040000L) != 0;
    row["minimizeBox"] = (style & 0x00020000L) != 0;
    row["maximizeBox"] = (style & 0x00010000L) != 0;
    row["maximized"] = IsZoomed(hwnd);
    row["minimized"] = IsIconic(hwnd);
    return row;
  }

  public static Dictionary<string, object> SystemDpi() {
    uint dpiX = 0, dpiY = 0;
    int scale = 0;
    IntPtr monitor = MonitorFromPoint(new Point(0, 0), 1);
    GetDpiForMonitor(monitor, 0, out dpiX, out dpiY);
    GetScaleFactorForMonitor(monitor, out scale);
    Dictionary<string, object> row = new Dictionary<string, object>();
    row["systemDpi"] = (long)GetDpiForSystem();
    row["primaryMonitorDpi"] = (long)dpiX;
    row["primaryMonitorScalePercent"] = (long)Math.Round(dpiX * 100.0 / 96.0);
    row["primaryMonitorScaleFactor"] = (long)scale;
    return row;
  }

  // PrintWindow into a bitmap, save as PNG, and return the luminance standard deviation of a sampled grid.
  public static double Capture(IntPtr hwnd, int width, int height, string file, out bool printed) {
    using (Bitmap bitmap = new Bitmap(width, height, PixelFormat.Format32bppArgb)) {
      using (Graphics graphics = Graphics.FromImage(bitmap)) {
        IntPtr hdc = graphics.GetHdc();
        try { printed = PrintWindow(hwnd, hdc, 2); } finally { graphics.ReleaseHdc(hdc); }
      }
      bitmap.Save(file, ImageFormat.Png);
      BitmapData data = bitmap.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
      try {
        double sum = 0, sumSquares = 0;
        long count = 0;
        byte[] row = new byte[data.Stride];
        for (int y = 0; y < height; y += 3) {
          Marshal.Copy(new IntPtr(data.Scan0.ToInt64() + (long)y * data.Stride), row, 0, data.Stride);
          for (int x = 0; x < width; x += 3) {
            int offset = x * 4;
            double luminance = 0.114 * row[offset] + 0.587 * row[offset + 1] + 0.299 * row[offset + 2];
            sum += luminance; sumSquares += luminance * luminance; count++;
          }
        }
        if (count == 0) return 0;
        double mean = sum / count;
        return Math.Sqrt(Math.Max(0, sumSquares / count - mean * mean));
      } finally { bitmap.UnlockBits(data); }
    }
  }
}
'@

[PilaudeWindowProbe]::EnablePerMonitorV2()

function ConvertRow($dictionary) {
  $row = [ordered]@{}
  foreach ($key in $dictionary.Keys) { $row[$key] = $dictionary[$key] }
  $row
}

function Emit($rows) {
  ConvertTo-Json -InputObject @($rows) -Depth 5 -Compress
}

if ($Action -eq 'dpi') {
  Emit @((ConvertRow ([PilaudeWindowProbe]::SystemDpi())))
  exit 0
}

if ($TargetProcessId -le 0) { Fail 5 'TargetProcessId is required' }
if (-not (Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue)) { Fail 3 "Process $TargetProcessId does not exist" }

function ResolveHandle() {
  $windows = [PilaudeWindowProbe]::Find($TargetProcessId)
  if ($Handle -eq 0) {
    if ($windows.Count -eq 0) { Fail 5 "Process $TargetProcessId has no visible window" }
    return $windows[0]
  }
  $candidate = [IntPtr]$Handle
  if ([PilaudeWindowProbe]::OwnerOf($candidate) -ne $TargetProcessId) { Fail 5 "Window $Handle does not belong to process $TargetProcessId" }
  return $candidate
}

if ($Action -eq 'move') {
  $target = ResolveHandle
  if (-not [PilaudeWindowProbe]::Move($target, $X, $Y)) { Fail 5 "SetWindowPos failed for window $($target.ToInt64())" }
  Emit @((ConvertRow ([PilaudeWindowProbe]::Describe($target))))
  exit 0
}

if ($Action -eq 'close') {
  $target = ResolveHandle
  $posted = [PilaudeWindowProbe]::Close($target)
  Emit @([ordered]@{ handle = $target.ToInt64(); posted = $posted })
  exit 0
}

if ($CaptureDirectory -ne '') {
  try {
    New-Item -ItemType Directory -Force -Path $CaptureDirectory | Out-Null
    $marker = Join-Path $CaptureDirectory ('.probe-write-test-' + [Guid]::NewGuid().ToString('N'))
    [IO.File]::WriteAllText($marker, 'x')
    Remove-Item -LiteralPath $marker -Force
  } catch {
    Fail 4 "Capture directory is not writable: $CaptureDirectory ($($_.Exception.Message))"
  }
}

$rows = @()
foreach ($handleValue in [PilaudeWindowProbe]::Find($TargetProcessId)) {
  $row = ConvertRow ([PilaudeWindowProbe]::Describe($handleValue))
  if ($CaptureDirectory -ne '' -and $row.width -gt 0 -and $row.height -gt 0) {
    $file = Join-Path $CaptureDirectory ('os-window-' + $row.handle + '.png')
    $printed = $false
    $deviation = [PilaudeWindowProbe]::Capture($handleValue, $row.width, $row.height, $file, [ref]$printed)
    $row.printWindow = $printed
    $row.capture = $file
    $row.captureWidth = $row.width
    $row.captureHeight = $row.height
    $row.pixelStdDev = [Math]::Round($deviation, 3)
  }
  $rows += [pscustomobject]$row
}
Emit $rows
