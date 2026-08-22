import requests

proxy_str = "socks5h://3XKpMuG1:DAHdBGCj@130.49.45.94:62904"
proxies = {
    "http": proxy_str,
    "https": proxy_str
}

print(f"Testing proxy: {proxy_str}")
try:
    print("Fetching IP through proxy...")
    res = requests.get("https://api.ipify.org", proxies=proxies, timeout=10)
    print("IP via proxy:", res.text)
except Exception as e:
    print("Error:", str(e))
