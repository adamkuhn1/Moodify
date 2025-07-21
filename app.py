from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
import json
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)
CORS(app)

# Load playlist mapping
with open('playlists.json', 'r') as f:
    PLAYLISTS = json.load(f)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/get_playlist', methods=['POST'])
def get_playlist():
    data = request.get_json()
    emotion = data.get('emotion', 'neutral')
    genre = data.get('genre')
    
    session['last_emotion'] = emotion
    session['last_genre'] = genre
    
    # If genre is selected, look for emotion-genre combination
    if genre:
        # Try to find emotion-genre combination first
        emotion_genre_key = f"{emotion}_{genre}"
        if emotion_genre_key in PLAYLISTS:
            playlist = PLAYLISTS[emotion_genre_key]
        else:
            # Fallback to genre-only playlists
            playlist = PLAYLISTS.get(genre, PLAYLISTS.get('neutral', []))
    else:
        # Fallback to emotion-only playlists
        playlist = PLAYLISTS.get(emotion, PLAYLISTS.get('neutral', []))
    
    return jsonify({'playlist': playlist})

if __name__ == '__main__':
    app.run(debug=True) 