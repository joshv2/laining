import React, { useState, useEffect, useRef } from 'react';
import { formatPasukRef } from '@/lib/formatters/pasuk';

type Pasuk = {
  id: string;
  number: number;
  ref: string;
  hebrewText: string;
  englishText: string | null;
  chapterId: string;
  chapterNumber: number;
};

interface PasukSelectProps {
  rangePesukim: Pasuk[];
  endPasukId: string;
  handleEndPasukChange: (id: string) => void;
  loadingPesukim?: boolean;
}

export default function PasukSelect({
  rangePesukim,
  endPasukId,
  handleEndPasukChange,
  loadingPesukim = false,
}: PasukSelectProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedPasuk = rangePesukim?.find((p) => p.id === endPasukId);
  const visiblePesukim = rangePesukim?.slice(0, visibleCount) || [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLUListElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 20) {
      setVisibleCount((prev) => Math.min(prev + 10, rangePesukim.length));
    }
  };

  return (
    <div ref={containerRef} className="relative w-full mt-2">
      <button
        type="button"
        disabled={loadingPesukim || rangePesukim?.length === 0}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2 text-left flex justify-between items-center"
      >
        <span>
          {selectedPasuk ? formatPasukRef(selectedPasuk.ref) : 'Select Pasuk...'}
        </span>
        <span className="text-xs text-gray-400">▼</span>
      </button>

      {isOpen && (
        <ul
          onScroll={handleScroll}
          className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-orange-900/20 bg-white py-1 shadow-lg bg-white"
        >
          {visiblePesukim.map((p) => (
            <li
              key={p.id}
              onClick={(e) => {
                // Prevent parent <label> default behavior from re-triggering the toggle button.
                e.preventDefault();

                // 1. Stop the event from bubbling up to any document click handlers
                e.stopPropagation(); 
                
                // 2. Pass the ID back up to the page state
                handleEndPasukChange(p.id);
                
                // 3. Close the dropdown menu UI
                setIsOpen(false);
              }}
              className="cursor-pointer px-3 py-2 hover:bg-orange-50 text-sm"
            >
              {formatPasukRef(p.ref)}
            </li>
          ))}

          {visibleCount < rangePesukim.length && (
            <li className="px-3 py-1.5 text-center text-xs text-gray-400 border-t border-gray-100">
              Scroll for more...
            </li>
          )}
        </ul>
      )}
    </div>
  );
}