using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Diagnostics;
using System.Windows.Forms;

namespace ZierClaw
{
    public class LauncherForm : Form
    {
        private bool moving = false;
        private Point down;

        private const int WinW = 520;
        private const int WinH = 470;

        public LauncherForm()
        {
            this.Text = "ZierClaw";
            this.ClientSize = new Size(WinW, WinH);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.None;
            this.DoubleBuffered = true;
            this.BackColor = Color.FromArgb(99, 102, 241);

            // 关闭按钮（右上角）
            var close = NewBtn("×", 40, 34, WinW - 46, 6, 14);
            close.Click += delegate { this.Close(); };
            close.FlatAppearance.MouseOverBackColor = Color.FromArgb(180, 60, 180);
            this.Controls.Add(close);

            // Logo 居中（固定宽高，Left 居中）
            var logo = new PictureBox();
            string logoPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "zierclaw-logo.png");
            if (System.IO.File.Exists(logoPath)) { try { logo.Image = Image.FromFile(logoPath); } catch { } }
            logo.SizeMode = PictureBoxSizeMode.Zoom;
            logo.Width = 130; logo.Height = 130;
            logo.Left = (WinW - logo.Width) / 2;
            logo.Top = 78;
            logo.BackColor = Color.Transparent;
            this.Controls.Add(logo);

            // 主标题：固定宽度=WinW，TextAlign 居中
            this.Controls.Add(NewCenterLabel("ZierClaw", "Microsoft YaHei", 32, FontStyle.Bold, Color.White, 218, 84));

            // 副标题
            this.Controls.Add(NewCenterLabel("你的 AI 助手", "Microsoft YaHei", 14, FontStyle.Regular, Color.FromArgb(240,238,255), 268, 40));

            // 启动按钮（固定宽，居中）
            var btn = NewBtn("启  动", 230, 54, (WinW - 230) / 2, 330, 15);
            btn.BackColor = Color.FromArgb(139, 92, 246);
            btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(109, 40, 217);
            btn.Click += delegate { LaunchDashboard(); };
            this.Controls.Add(btn);

            // 底部版权
            this.Controls.Add(NewCenterLabel("Powered by ZierClaw · 墨", "Microsoft YaHei", 9, FontStyle.Regular, Color.FromArgb(222,219,246), WinH - 36, 0));

            // 拖动
            this.MouseDown += (s, e) => { moving = true; down = e.Location; };
            this.MouseMove += (s, e) => { if (moving) this.Location = new Point(this.Location.X + e.X - down.X, this.Location.Y + e.Y - down.Y); };
            this.MouseUp += (s, e) => moving = false;
        }

        // 固定全宽、水平居中文本的 Label
        private Label NewCenterLabel(string text, string font, int size, FontStyle style, Color color, int top, int height)
        {
            var l = new Label();
            l.Text = text;
            l.Font = new Font(font, size, style);
            l.ForeColor = color;
            l.BackColor = Color.Transparent;
            l.AutoSize = false;
            l.Width = WinW;
            l.Height = height;          // 高度（0 表示自适应单行）
            l.TextAlign = ContentAlignment.MiddleCenter;  // 水平+垂直居中
            l.Left = 0;
            l.Top = top;
            return l;
        }

        private Button NewBtn(string text, int w, int h, int left, int top, int fontSize)
        {
            var b = new Button();
            b.Text = text;
            b.Font = new Font("Microsoft YaHei", fontSize, FontStyle.Bold);
            b.ForeColor = Color.White;
            b.FlatStyle = FlatStyle.Flat;
            b.FlatAppearance.BorderSize = 0;
            b.BackColor = Color.FromArgb(139, 92, 246);
            b.Width = w; b.Height = h;
            b.Left = left; b.Top = top;
            b.Cursor = Cursors.Hand;
            return b;
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using (var brush = new LinearGradientBrush(
                this.ClientRectangle,
                Color.FromArgb(99, 102, 241),
                Color.FromArgb(236, 72, 153),
                35f))
            {
                e.Graphics.FillRectangle(brush, this.ClientRectangle);
            }
            // 顶栏：同紫渐变但加深半透明
            using (var bar = new SolidBrush(Color.FromArgb(60, 0, 0, 0)))
            {
                e.Graphics.FillRectangle(bar, 0, 0, WinW, 46);
            }
            // 顶栏标题（左侧，同色系）
            using (var f = new Font("Microsoft YaHei", 10, FontStyle.Bold))
            using (var b = new SolidBrush(Color.White))
            {
                e.Graphics.TextRenderingHint = TextRenderingHint.AntiAlias;
                e.Graphics.DrawString("ZierClaw", f, b, 16, 13);
            }
            // 顶栏分隔线
            using (var line = new Pen(Color.FromArgb(120, 255, 255, 255)))
            {
                e.Graphics.DrawLine(line, 0, 46, WinW, 46);
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
                MessageBox.Show("启动失败: " + ex.Message, "ZierClaw", MessageBoxButtons.OK, MessageBoxIcon.Error);
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
