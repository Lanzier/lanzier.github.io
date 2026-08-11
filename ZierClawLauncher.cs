using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Diagnostics;
using System.Windows.Forms;

namespace ZierClaw
{
    public class LauncherForm : Form
    {
        public LauncherForm()
        {
            this.Text = "ZierClaw";
            this.ClientSize = new Size(430, 330);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.DoubleBuffered = true;

            // Title
            var title = new Label();
            title.Text = "ZierClaw";
            title.Font = new Font("Segoe UI", 26, FontStyle.Bold);
            title.ForeColor = Color.White;
            title.AutoSize = true;
            title.Left = (this.ClientSize.Width - title.Width) / 2;
            title.Top = 60;
            title.BackColor = Color.Transparent;
            this.Controls.Add(title);

            // Subtitle
            var sub = new Label();
            sub.Text = "Your AI assistant";
            sub.Font = new Font("Segoe UI", 11);
            sub.ForeColor = Color.FromArgb(235, 230, 255);
            sub.AutoSize = true;
            sub.Left = (this.ClientSize.Width - sub.Width) / 2;
            sub.Top = 112;
            sub.BackColor = Color.Transparent;
            this.Controls.Add(sub);

            // Launch button
            var btn = new Button();
            btn.Text = "Launch ZierClaw";
            btn.Font = new Font("Segoe UI", 13, FontStyle.Bold);
            btn.ForeColor = Color.White;
            btn.FlatStyle = FlatStyle.Flat;
            btn.FlatAppearance.BorderSize = 0;
            btn.Width = 220;
            btn.Height = 52;
            btn.Left = (this.ClientSize.Width - btn.Width) / 2;
            btn.Top = 165;
            btn.Cursor = Cursors.Hand;
            btn.BackColor = Color.FromArgb(99, 102, 241);
            btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(109, 40, 217);
            btn.Click += delegate { LaunchDashboard(); };
            this.Controls.Add(btn);

            // Footer
            var foot = new Label();
            foot.Text = "Powered by ZierClaw";
            foot.Font = new Font("Segoe UI", 9);
            foot.ForeColor = Color.FromArgb(215, 210, 240);
            foot.AutoSize = true;
            foot.Left = (this.ClientSize.Width - foot.Width) / 2;
            foot.Top = 280;
            foot.BackColor = Color.Transparent;
            this.Controls.Add(foot);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (var brush = new LinearGradientBrush(
                this.ClientRectangle,
                Color.FromArgb(99, 102, 241),   // #6366f1
                Color.FromArgb(236, 72, 153),  // #ec4899
                45f))
            {
                e.Graphics.FillRectangle(brush, this.ClientRectangle);
            }
            // draw a Z letter accent
            using (var f = new Font("Segoe UI", 60, FontStyle.Bold))
            {
                TextRenderer.DrawText(e.Graphics, "Z", f, new Point(this.ClientSize.Width - 110, 20), Color.FromArgb(255, 255, 255));
            }
        }

        private void LaunchDashboard()
        {
            try
            {
                var psi = new ProcessStartInfo("cmd.exe", "/c start \"\" /min openclaw dashboard");
                psi.UseShellExecute = true;
                psi.CreateNoWindow = true;
                Process.Start(psi);
            }
            catch (Exception ex)
            {
                MessageBox.Show("Launch failed: " + ex.Message, "ZierClaw",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            this.Close();
        }
    }

    public static class Program
    {
        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new LauncherForm());
        }
    }
}
