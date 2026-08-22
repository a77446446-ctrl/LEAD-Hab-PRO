import requests
import sys

proxy_str = "http://3XKpMuG1:DAHdBGCj@130.49.45.94:62904"
proxies = {
    "http": proxy_str,
    "https": proxy_str
}

print(f"Testing proxy: {proxy_str}")
try:
    print("Fetching IP through proxy...")
    res = requests.get("https://api.ipify.org", proxies=proxies, timeout=10)
    print("IP via proxy:", res.text)
    
    print("Fetching web.max.ru through proxy...")
    res2 = requests.get("https://web.max.ru", proxies=proxies, timeout=10)
    print("Status:", res2.status_code)
except Exception as e:
    print("Error:", str(e))
