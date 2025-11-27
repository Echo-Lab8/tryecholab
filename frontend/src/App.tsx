import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './App.css'
import Home from './components/Home'
import VideoPage from './components/VideoPage'
import BlogList from './components/BlogList'
import BlogPostComponent from './components/BlogPost'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/blog" element={<BlogList />} />
        <Route path="/video" element={<VideoPage />} />
        <Route path="/blog/:slug" element={<BlogPostComponent />} />
      </Routes>
    </Router>
  )
}

export default App
