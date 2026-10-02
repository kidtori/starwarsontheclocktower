using System;
using System.Diagnostics;
using System.IO;
using System.Drawing;
using System.Windows.Forms;

internal static class Launcher {
    [STAThread]
    private static void Main(string[] args) {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string node = Path.Combine(root, "runtime", "node.exe");
        string server = Path.Combine(root, "server.js");
        if (!File.Exists(node) || !File.Exists(server)) {
            MessageBox.Show("Extract the whole Clocktower Studio ZIP before launching. Keep the executable beside server.js and the runtime folder.", "Clocktower Studio");
            return;
        }
        if (Array.IndexOf(args, "--self-test") >= 0) {
            var test = Process.Start(new ProcessStartInfo(node, "--check \"" + server + "\"") { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = root });
            test.WaitForExit(); Environment.Exit(test.ExitCode); return;
        }
        Application.EnableVisualStyles();
        var start = new ProcessStartInfo(node, "\"" + server + "\" --open") { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = root };
        // Use this installation's data, even if the parent shell has a test override.
        start.EnvironmentVariables.Remove("STUDIO_ROOT");
        start.EnvironmentVariables.Remove("PORT");
        using (var child = Process.Start(start))
        using (var tray = new NotifyIcon()) {
            tray.Icon = SystemIcons.Application;
            tray.Text = "Clocktower Studio";
            var menu = new ContextMenuStrip();
            menu.Items.Add("Open Clocktower Studio", null, delegate { Process.Start(new ProcessStartInfo("http://127.0.0.1:3210") { UseShellExecute = true }); });
            menu.Items.Add("Exit Clocktower Studio", null, delegate { if (!child.HasExited) child.Kill(); Application.Exit(); });
            tray.ContextMenuStrip = menu;
            tray.DoubleClick += delegate { Process.Start(new ProcessStartInfo("http://127.0.0.1:3210") { UseShellExecute = true }); };
            tray.Visible = true;
            var timer = new Timer { Interval = 500 };
            timer.Tick += delegate { if (child.HasExited) Application.Exit(); };
            timer.Start();
            Application.Run();
            timer.Dispose(); tray.Visible = false;
        }
    }
}
