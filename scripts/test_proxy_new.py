import requests

proxy_str = "http://3XKpMuG1:DAHdBGCj@201.87.20.141:65076"
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
