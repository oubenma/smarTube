import { useState, useEffect } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './App.css';

const API_URL = 'http://localhost:3001/api';

function App() {
    const [videoUrl, setVideoUrl] = useState('');
    const [summary, setSummary] = useState('');
    const [chatHistory, setChatHistory] = useState([]);
    const [question, setQuestion] = useState('');
    const [isLoadingSummary, setIsLoadingSummary] = useState(false);
    const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
    const [error, setError] = useState('');
    const [theme, setTheme] = useState('light');

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'light';
        setTheme(savedTheme);
        document.documentElement.className = savedTheme;
    }, []);

    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.className = newTheme;
    };

    const handleSummarize = async () => {
        if (!videoUrl) {
            setError('Please enter a YouTube video URL.');
            return;
        }
        setError('');
        setIsLoadingSummary(true);
        setSummary('');
        setChatHistory([]);

        try {
            const response = await axios.post(`${API_URL}/summarize`, { youtubeUrl: videoUrl });
            setSummary(response.data.summary);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to get summary.');
        } finally {
            setIsLoadingSummary(false);
        }
    };

    const handleAskQuestion = async () => {
        if (!question) return;

        const newChatHistory = [...chatHistory, { type: 'user', message: question }];
        setChatHistory(newChatHistory);
        setQuestion('');
        setIsLoadingAnswer(true);
        setError('');

        try {
            const response = await axios.post(`${API_URL}/ask`, { youtubeUrl: videoUrl, question });
            setChatHistory([...newChatHistory, { type: 'assistant', message: response.data.answer }]);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to get answer.');
            setChatHistory([...newChatHistory, { type: 'assistant', message: `Error: ${err.response?.data?.error || 'Failed to get answer.'}` }]);
        } finally {
            setIsLoadingAnswer(false);
        }
    };


    return (
        <div className="app-container">
            <header className="app-header">
                <h1>SmarTube Web</h1>
                <div className="theme-switcher">
                    <button onClick={() => handleThemeChange('light')} className={theme === 'light' ? 'active' : ''}>Light</button>
                    <button onClick={() => handleThemeChange('dark')} className={theme === 'dark' ? 'active' : ''}>Dark</button>
                </div>
            </header>
            <main>
                <div className="input-section">
                    <input
                        type="text"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        placeholder="Enter YouTube Video URL"
                    />
                    <button onClick={handleSummarize} disabled={isLoadingSummary}>
                        {isLoadingSummary ? 'Summarizing...' : '✨ Get Summary'}
                    </button>
                </div>

                {error && <div className="error-message">{error}</div>}

                <div className="results-section">
                    {summary && (
                        <div className="summary-container">
                            <h2>Summary</h2>
                            <ReactMarkdown>{summary}</ReactMarkdown>
                        </div>
                    )}

                    {summary && (
                         <div className="qa-section">
                            <div className="chat-history">
                                {chatHistory.map((chat, index) => (
                                    <div key={index} className={`chat-message ${chat.type}`}>
                                        <ReactMarkdown>{chat.message}</ReactMarkdown>
                                    </div>
                                ))}
                                {isLoadingAnswer && <div className="chat-message assistant">Thinking...</div>}
                            </div>
                            <div className="qa-input">
                                <textarea
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="Ask a question about the video..."
                                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAskQuestion()}
                                />
                                <button onClick={handleAskQuestion} disabled={!question || isLoadingAnswer}>➤</button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;