# Cognivault

Cognivault — RAG-Powered AI Knowledge & Productivity Platform

## Features

- Real-time AI-powered conversations with streaming responses
- Persistent conversation history with MongoDB
- Dark and light theme support
- Markdown rendering with syntax highlighting for code blocks
- Conversation search and management
- Copy responses to clipboard
- Word count and timestamps for messages
- Responsive design for mobile and desktop

## Tech Stack

### Frontend
- React 19
- Vite
- React Markdown with syntax highlighting
- UUID for unique thread identification

### Backend
- Node.js with Express
- MongoDB with Mongoose
- OpenAI API integration
- CORS enabled for cross-origin requests

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or Atlas)
- OpenAI API key

## Installation

1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/Cognivault.git
cd Cognivault
```

2. Install backend dependencies
```bash
cd Backend
npm install
```

3. Install frontend dependencies
```bash
cd ../Frontend
npm install
```

4. Configure environment variables

Create a `.env` file in the `Backend` directory:
```
PORT=8080
OPENAI_API_KEY=your_openai_api_key
MONGODB_URI=your_mongodb_connection_string
```

## Running the Application

1. Start the backend server
```bash
cd Backend
npm run dev
```

2. Start the frontend development server
```bash
cd Frontend
npm run dev
```

3. Open your browser and navigate to `http://localhost:5173`

## Project Structure
```
Cognivault/
├── Backend/
│   ├── models/
│   │   └── Thread.js
│   ├── routes/
│   │   └── chat.js
│   ├── utils/
│   │   └── openai.js
│   ├── server.js
│   └── package.json
├── Frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── Chat.jsx
│   │   ├── ChatWindow.jsx
│   │   ├── Sidebar.jsx
│   │   ├── MyContext.jsx
│   │   └── assets/
│   ├── index.html
│   └── package.json
└── README.md
```

## API Endpoints

- `GET /api/thread` - Retrieve all conversation threads
- `GET /api/thread/:threadId` - Retrieve specific thread messages
- `POST /api/chat` - Send message and receive AI response
- `DELETE /api/thread/:threadId` - Delete a conversation thread

## Contributing

This is a personal project. Contributions are not currently accepted.

## License

This project is licensed under the ISC License.

## Author

Ritesh Chopade

## Acknowledgments

Built using OpenAI's GPT models for natural language processing capabilities.