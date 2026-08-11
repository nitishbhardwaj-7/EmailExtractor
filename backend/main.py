from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from scrapper import deep_scrape_company, get_driver

app = FastAPI(title="Email Extractor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScrapeRequest(BaseModel):
    urls: List[str]


@app.get("/")
def health():
    return {"status": "ok", "message": "Email Extractor API is running"}


@app.post("/api/scrape")
def scrape(request: ScrapeRequest):
    if not request.urls:
        raise HTTPException(status_code=400, detail="No URLs provided")
    if len(request.urls) > 50:
        raise HTTPException(status_code=400, detail="Max 50 URLs per request")

    results = []
    driver = None
    try:
        driver = get_driver()
        for url in request.urls:
            if not url.startswith("http"):
                url = "https://" + url
            try:
                data = deep_scrape_company(driver, url)
                results.append({
                    "url": url,
                    "domain": data["company_domain"],
                    "emails": data["emails"],
                    "count": len(data["emails"])
                })
            except Exception as e:
                results.append({
                    "url": url,
                    "domain": url,
                    "emails": [],
                    "count": 0,
                    "error": str(e)
                })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraper error: {str(e)}")
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass

    all_emails = list(set(
        email
        for result in results
        for email in result["emails"]
    ))

    return {
        "results": results,
        "total_emails": len(all_emails),
        "all_emails": all_emails
    }
