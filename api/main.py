from fastapi import FastAPI, Query
from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import urlparse, parse_qs

app = FastAPI()

def extract_video_id(url):
    query = parse_qs(urlparse(url).query)
    return query.get("v", [None])[0]

@app.get("/subtitles")
def get_subtitles(link: str = Query(...)):
    video_id = extract_video_id(link)
    if not video_id:
        return {"error": "Invalid YouTube URL"}
    transcript = YouTubeTranscriptApi.get_transcript(video_id)
    return transcript
