# SignVerse 👐

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.3.3-lightgrey.svg)](https://flask.palletsprojects.com/)

SignVerse is a comprehensive web-based platform designed to bridge the communication gap for the deaf and mute community. It provides an integrated solution for learning sign language, real-time translation between sign language and text, and seamless communication tools.

## 🌟 Features

### Core Translation Features
- **Real-time Sign-to-Text Translation**: Uses advanced computer vision (YOLOv8) to translate sign language gestures into text in real-time
- **Text-to-Sign Translation**: Convert written text into animated sign language videos
- **Video Chat with Translation**: Real-time video communication with automatic sign language translation

### Learning Platform
- **Interactive Learning Modules**: Structured lessons covering alphabets, numbers, and common words
- **Progress Tracking**: User progress monitoring and completion tracking across lessons
- **Practice Tests**: Interactive tests to reinforce learning

### Communication Tools
- **Integrated Chat System**: Real-time messaging with user profiles and friend management
- **Grammar Correction**: AI-powered grammar correction for written text
- **Style Enhancement**: Text rewriting in different styles (formal, professional, persuasive, casual, poetic)
- **Language Conversion**: Translation to Indian languages (Hindi, Bengali, Tamil, Telugu, etc.)

### User Management
- **User Authentication**: Secure login and registration system
- **Profile Management**: User profiles with personal information and progress tracking
- **Feedback System**: Community feedback with like/dislike reactions
- **Password Recovery**: Secure password reset functionality

### AI-Powered Features
- **Intelligent Chatbot**: Custom-trained chatbot for sign language assistance using Ollama
- **Sentence Correction**: Grammar and style correction using AI models

## 🛠 Technology Stack

### Backend
- **Framework**: Flask 2.3.3
- **Database**: MySQL 8.0+
- **Real-time Communication**: Socket.IO 5.8.0
- **Authentication**: Flask-Session
- **API**: RESTful APIs with JSON responses

### Frontend
- **HTML5/CSS3**: Responsive web design
- **JavaScript**: Dynamic user interactions
- **WebRTC**: Real-time video communication
- **Canvas API**: Real-time video processing

### AI/ML
- **Computer Vision**: YOLOv8 (Ultralytics)
- **Chatbot**: Ollama with custom Sign_Setu model
- **Text Processing**: Gemma2:2b model for grammar and style correction

### Infrastructure
- **Web Server**: Flask development server / Gunicorn (production)
- **Database Connector**: MySQL Connector Python
- **Environment**: Python 3.8+
- **Dependencies**: See `requirements.txt`

## 📁 Project Structure

```
SignVerse/
├── app.py                      # Main Flask application
├── requirements.txt            # Python dependencies
├── README.md                   # Project documentation
├── .env                        # Environment variables (create this)
├── chatbot/                    # Chatbot module
│   ├── Modelfile               # Ollama model configuration
│   ├── ollama_dataset.jsonl    # Training dataset
│   ├── checkpoint-2600/        # Model checkpoints
│   └── README.md              # Chatbot documentation
├── models/                     # ML models
│   └── best_m_train.pt        # YOLOv8 model weights
├── static/                     # Static assets
│   ├── css/                   # Stylesheets
│   ├── js/                    # JavaScript files
│   ├── images/                # Alphabet/number images
│   └── signs/                 # Sign language videos
├── templates/                 # HTML templates
│   ├── index.html            # Homepage
│   ├── login.html            # Login page
│   ├── learning_mode.html    # Learning hub
│   ├── real_time_translation_fixed.html  # Sign-to-text
│   ├── text-to-sign-fixed.html           # Text-to-sign
│   └── chat/                  # Chat templates
└── .git/                      # Git repository
```

## 🚀 Installation & Setup

### Prerequisites

- **Python 3.8+**: Download from [python.org](https://python.org)
- **MySQL 8.0+**: Download from [mysql.com](https://mysql.com)
- **Ollama**: Download from [ollama.ai](https://ollama.ai)
- **Git**: Version control system

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/SignVerse.git
cd SignVerse
```

### 2. Set Up Python Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Set Up MySQL Database

```sql
-- Create database
CREATE DATABASE signverse_app;

-- Create chatting database for chat subsystem
CREATE DATABASE chatting_db;
```

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Flask Configuration
SECRET_KEY=your_super_secret_key_here
FLASK_ENV=development

# MySQL Configuration
MYSQL_HOST=localhost
MYSQL_USER=your_mysql_username
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=signverse_app

# Chat Database (separate from main app)
CHAT_DATABASE_URI=mysql+mysqlconnector://username:password@localhost/chatting_db

# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
```

### 5. Set Up Ollama Models

#### Install Ollama
```bash
# On macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# On Windows - download from ollama.ai
```

#### Pull Required Models
```bash
# Pull the base models
ollama pull gemma2:2b

# Create custom Sign_Setu chatbot model
ollama create Sign_Setu -f chatbot/Modelfile
```

#### Verify Models
```bash
ollama list
# Should show: gemma2:2b and Sign_Setu
```

### 6. Initialize Database Tables

The application will automatically create required tables on first run. The main tables include:

- `users`: User accounts and profiles
- `feedback`: User feedback and reactions
- `lesson_progress`: Learning progress tracking
- Chat-related tables in `chatting_db`

### 7. Run the Application

```bash
# Make sure Ollama is running in background
ollama serve

# Run the Flask application
python app.py
```

The application will be available at `http://localhost:5001`

## 📖 Usage Guide

### For Learners
1. **Register/Login**: Create an account or log in
2. **Learning Mode**: Access structured lessons in `/learning-hub`
3. **Practice**: Complete lessons and track progress
4. **Take Tests**: Validate learning with interactive tests

### For Communication
1. **Real-time Translation**: Use `/real_time_translation` for sign-to-text
2. **Text-to-Sign**: Convert text to sign videos at `/text-to-sign`
3. **Video Chat**: Join video calls with translation at `/video`

### For Advanced Features
1. **Grammar Correction**: Use AI to correct sentence grammar
2. **Style Enhancement**: Rewrite text in different styles
3. **Language Conversion**: Translate to Indian languages
4. **Chatbot**: Get help from the Sign_Setu AI assistant

## 🔧 API Documentation

### Authentication Endpoints

#### Login
```http
POST /login
Content-Type: application/json

{
  "username": "user@example.com",
  "password": "password123"
}
```

#### Check Login Status
```http
GET /api/login-status
```

### Translation Endpoints

#### Sign-to-Text Detection
```http
POST /detect
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

#### Text-to-Sign Conversion
```http
POST /get_images
Content-Type: application/json

{
  "input": "Hello World"
}
```

### Learning Endpoints

#### Get Lesson Progress
```http
GET /api/lesson-progress/{lesson_number}
```

#### Update Lesson Progress
```http
POST /api/lesson-progress/{lesson_number}
Content-Type: application/json

{
  "completed_until": 5,
  "is_completed": false
}
```

### AI Features

#### Grammar Correction
```http
POST /grammar_correction
Content-Type: application/json

{
  "text": "This sentence have grammar error"
}
```

#### Style Enhancement
```http
POST /style_enhance
Content-Type: application/json

{
  "text": "Hello world",
  "style": "formal"
}
```

#### Language Conversion
```http
POST /language_conversion
Content-Type: application/json

{
  "text": "Hello world",
  "language": "hindi"
}
```

#### Chatbot
```http
POST /api/chatbot
Content-Type: application/json

{
  "message": "How do I sign 'thank you'?"
}
```

## 🔧 Configuration

### YOLOv8 Model Configuration

The sign detection model can be configured in `app.py`:

```python
MODEL_PATH = "models/best_m_train.pt"
CONF_THRESHOLD = 0.3  # Detection confidence threshold
STABLE_SIGN_SECONDS = 1.75  # Hold time for sign recognition
```

### Timing Configurations

```python
SPACE_AFTER = 3.5  # Seconds before adding space
COMMA_AFTER = 8.0  # Seconds before adding comma
FULLSTOP_AFTER = 12.0  # Seconds before adding period
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Commit changes**: `git commit -m 'Add amazing feature'`
4. **Push to branch**: `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Development Guidelines

- Follow PEP 8 style guidelines
- Add tests for new features
- Update documentation
- Ensure all tests pass

### Setting up Development Environment

```bash
# Install development dependencies
pip install -r requirements-dev.txt

# Run tests
python -m pytest

# Run with debug mode
FLASK_ENV=development python app.py
```

## 🐛 Troubleshooting

### Common Issues

#### Ollama Connection Issues
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama service
ollama serve
```

#### Database Connection Issues
- Verify MySQL is running
- Check credentials in `.env`
- Ensure databases exist

#### Model Loading Issues
- Verify model files exist in `models/` directory
- Check PyTorch installation
- Ensure CUDA compatibility (if using GPU)

#### Webcam Access Issues
- Grant browser permissions for camera
- Check camera availability
- Try different browsers

## 📊 Performance

### System Requirements

- **Minimum**: 4GB RAM, Dual-core CPU
- **Recommended**: 8GB RAM, Quad-core CPU, Dedicated GPU
- **Storage**: 2GB free space

### Performance Tips

1. **Use GPU**: Install CUDA for faster YOLOv8 inference
2. **Optimize Models**: Fine-tune confidence thresholds
3. **Database Indexing**: Ensure proper MySQL indexes
4. **Caching**: Implement Redis for session caching

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Devloper's Info

- **[Shubham Dey](https://github.com/shubh-1112)** 
## 🙏 Acknowledgments

- **Ultralytics** for YOLOv8 model
- **Ollama** for local AI model hosting
- **Flask** community for excellent documentation
- **Open source contributors** for various libraries used

## 📞 Support

For support, please:
- Open an issue on GitHub
- Contact the development team
- Check the troubleshooting section

---

**SignVerse** - Empowering communication through technology 👐✨
