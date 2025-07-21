from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
import json
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)
CORS(app)

# Load playlist mappings from JSON
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

    # Prioritize emotion-genre combo, then genre, then emotion, then neutral fallback
    if genre:
        emotion_genre_key = f"{emotion}_{genre}"
        if emotion_genre_key in PLAYLISTS:
            playlist = PLAYLISTS[emotion_genre_key]
        else:
            playlist = PLAYLISTS.get(genre, PLAYLISTS.get('neutral', []))
    else:
        playlist = PLAYLISTS.get(emotion, PLAYLISTS.get('neutral', []))

    return jsonify({'playlist': playlist})

if __name__ == '__main__':
    app.run(debug=True) 