interface FABProps {
  onClick: () => void;
  className?: string;
}

export function FAB({ onClick, className = '' }: FABProps) {
  return (
    <button
      onClick={onClick}
      data-tutorial-id="tutorial-fab"
      className={`
        fixed bottom-5 left-1/2 -translate-x-1/2 md:bottom-6 md:right-6 md:left-auto md:translate-x-0
        w-14 h-14 md:w-16 md:h-16
        bg-blue-600 hover:bg-blue-700 active:bg-blue-800
        text-white
        rounded-full
        shadow-lg hover:shadow-xl
        flex items-center justify-center
        transition-all duration-200 ease-in-out
        hover:scale-105 active:scale-95
        focus:outline-none focus:ring-4 focus:ring-blue-500/50
        z-50
        ${className}
      `}
      aria-label="Add new entry"
      type="button"
    >
      <svg 
        className="w-6 h-6 md:w-7 md:h-7" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={2.5}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          d="M12 4v16m8-8H4" 
        />
      </svg>
    </button>
  );
}
