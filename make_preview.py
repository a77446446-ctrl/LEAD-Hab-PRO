import os
import sys

def main():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
        from PIL import Image, ImageDraw, ImageFont

    W, H = 1200, 630
    img_path = r"C:\Users\Anex\.gemini\antigravity\brain\384b85c4-fd36-4867-906f-f030fda622ad\.user_uploaded\media_1788377386524.png"
    out_path = r"d:\Рабочий стол D\GPT Ai\Projects\MAKS-LEAD-HUB\MAKS-LEAD-HUB\public\preview-banner.jpg"

    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    draw = ImageDraw.Draw(canvas)

    try:
        logo = Image.open(img_path)
        logo.thumbnail((550, 550), Image.Resampling.LANCZOS)
        lx = 30
        ly = (H - logo.height) // 2
        if logo.mode == "RGBA":
            canvas.paste(logo, (lx, ly), logo)
        else:
            canvas.paste(logo, (lx, ly))
    except Exception as e:
        print(f"Error with logo: {e}")

    def get_font(name, size):
        try:
            return ImageFont.truetype(name, size)
        except:
            return ImageFont.load_default()
            
    font_title = get_font("arialbd.ttf", 52)
    font_sub = get_font("arial.ttf", 36)
    font_url = get_font("arialbd.ttf", 36)

    tx = 600
    
    title = "ПО ДЕЛАМ\nработа и подработка\nв вашем городе"
    draw.text((tx, 130), title, fill=(0, 0, 0), font=font_title, spacing=10)
    
    draw.line([(tx, 330), (tx + 550, 330)], fill=(208, 234, 26), width=8)
    
    subtitle = "Вакансии: стройка, ремонт,\nгрузчики, водители,\nдоставка и другое."
    draw.text((tx, 370), subtitle, fill=(70, 70, 70), font=font_sub, spacing=8)
    
    draw.rectangle([(0, H - 70), (W, H)], fill=(15, 15, 15))
    url_text = "podelam24.ru   |   поделам.рф"
    
    try:
        bbox = draw.textbbox((0, 0), url_text, font=font_url)
        tw = bbox[2] - bbox[0]
    except:
        tw = 500
        
    draw.text(((W - tw) / 2, H - 55), url_text, fill=(208, 234, 26), font=font_url)

    canvas.save(out_path, quality=95)
    print("Done")

if __name__ == "__main__":
    main()

