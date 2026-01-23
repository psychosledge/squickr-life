import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-4xl mx-auto p-8 text-center">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Squickr Life
        </h1>
        <p className="text-2xl text-muted-foreground mb-8">
          Get shit done quicker with Squickr!
        </p>
        
        <div className="bg-card border rounded-lg p-8 shadow-lg">
          <h2 className="text-3xl font-semibold mb-4">
            Welcome to Your Event-Sourced Bullet Journal
          </h2>
          
          <p className="text-lg text-muted-foreground mb-6">
            This app is being built with:
          </p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded">
              <span className="font-semibold">Event Sourcing</span>
            </div>
            <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded">
              <span className="font-semibold">CQRS</span>
            </div>
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded">
              <span className="font-semibold">Strict TDD</span>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded">
              <span className="font-semibold">Offline-First PWA</span>
            </div>
          </div>

          <button
            onClick={() => setCount((count) => count + 1)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Test Counter: {count}
          </button>
          
          <p className="mt-6 text-sm text-muted-foreground">
            Built by the AI Agent Team: Morgan, Alex, Terry, Casey & Speedy Sam
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
