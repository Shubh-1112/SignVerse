# SignVerse

SignVerse is a web application designed to bridge the communication gap for the deaf and mute community. It provides a platform for learning sign language, translating sign language to text, and text to sign language in real-time.

## Features

- **Learning Mode:** Interactive lessons to learn sign language, covering alphabets, numbers, and words.
- **Sign-to-Text Translation:** Real-time translation of sign language gestures into text using a webcam.
- **Text-to-Sign Translation:** Convert text into a sequence of sign language videos.
- **Real-time Communication:** A video chat application with real-time translation features for seamless communication.
- **User Profiles:** Users can create accounts, track their progress, and manage their profiles.
- **Feedback System:** A feedback system for users to share their thoughts and suggestions.
- **Chat:** A chat system for users to communicate with each other.

## Technology Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Flask (Python)
- **Database:** MySQL
- **Machine Learning:** PyTorch, YOLOv8
- **Real-time Communication:** Socket.IO

## Setup and Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/SignVerse.git
   cd SignVerse
   ```

2. **Create a virtual environment and activate it:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
   ```

3. **Install the dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up the database:**
   - Make sure you have MySQL installed and running.
   - Create a database named `signverse_app`.
   - Create a `.env` file in the root directory and add the following environment variables:
     ```
     MYSQL_HOST=localhost
     MYSQL_USER=your_mysql_username
     MYSQL_PASSWORD=your_mysql_password
     MYSQL_DATABASE=signverse_app
     SECRET_KEY=your_secret_key
     ```

5. **Run the application:**
   ```bash
   python app.py
   ```
   The application will be running at `http://localhost:5001`.

## Team

- [Shubh](https://github.com/shubh-saurabh)
- [Dishita](https://github.com/dishita-g)
- [Kashish](https://github.com/kashish-goyal)
