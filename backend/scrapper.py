from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from urllib.parse import urlparse
import re
import time


def get_driver():
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    return webdriver.Chrome(options=options)


def is_valid_human_email(email):
    junk_domains = ['sentry.io', 'wixpress', 'example.com', 'domain.com']
    junk_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']
    if any(junk in email.lower() for junk in junk_domains):
        return False
    if any(email.lower().endswith(ext) for ext in junk_extensions):
        return False
    username = email.split('@')[0]
    if len(username) > 25:
        return False
    return True


def extract_emails_from_text(text):
    standard_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    standard_emails = re.findall(standard_pattern, text)

    obfuscated_pattern = r'([a-zA-Z0-9._%+-]+)\s*(?:@|\[at\]|\(at\)| at |<at>)\s*([a-zA-Z0-9.-]+)\s*(?:\.|\[dot\]|\(dot\)| dot |<dot>)\s*([a-zA-Z]{2,})'
    raw_obfuscated = re.findall(obfuscated_pattern, text, re.IGNORECASE)
    obfuscated_emails = [f"{parts[0]}@{parts[1]}.{parts[2]}" for parts in raw_obfuscated]

    all_found = standard_emails + obfuscated_emails
    return [e for e in all_found if is_valid_human_email(e)]


def scrape_page(driver, url):
    try:
        driver.get(url)
        time.sleep(4)
    except Exception:
        return {"emails": [], "links": []}

    results = {"emails": [], "links": []}

    try:
        body_text = driver.execute_script("return document.body.innerText;")
        results["emails"].extend(extract_emails_from_text(body_text))
    except Exception:
        pass

    page_source = driver.page_source
    results["emails"].extend(extract_emails_from_text(page_source))

    try:
        mailto_hrefs = driver.execute_script(
            "return Array.from(document.querySelectorAll('a[href^=\"mailto:\"]')).map(a => a.href);"
        )
        for href in mailto_hrefs:
            if href and isinstance(href, str):
                email = href.replace("mailto:", "").strip().split('?')[0]
                if email and is_valid_human_email(email):
                    results["emails"].append(email)
    except Exception:
        pass

    results["emails"] = list(set([e.lower() for e in results["emails"]]))

    try:
        all_hrefs = driver.execute_script(
            "return Array.from(document.querySelectorAll('a')).map(a => a.href);"
        )
        for href in all_hrefs:
            if href and isinstance(href, str) and "javascript:" not in href and href.startswith("http"):
                results["links"].append(href)
    except Exception:
        pass

    results["links"] = list(set(results["links"]))
    return results


def deep_scrape_company(driver, base_url):
    domain = urlparse(base_url).netloc or base_url

    all_emails = set()
    visited_urls = set()

    homepage_data = scrape_page(driver, base_url)
    visited_urls.add(base_url)
    all_emails.update(homepage_data["emails"])

    keywords = ['contact', 'about', 'team', 'support']
    target_urls = []

    for link in homepage_data["links"]:
        if domain in urlparse(link).netloc:
            if any(keyword in link.lower() for keyword in keywords):
                if link not in visited_urls:
                    target_urls.append(link)

    target_urls = list(set(target_urls))

    for target_url in target_urls[:5]:
        visited_urls.add(target_url)
        page_data = scrape_page(driver, target_url)
        all_emails.update(page_data["emails"])
        time.sleep(2)

    return {
        "company_domain": domain,
        "emails": list(all_emails)
    }
