import React, { useState, useEffect, useRef } from 'react';

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

function formatPasukId(id: string): string {
  if (!id) return '';
  const parts = id.split('-');
  if (parts.length < 3) return id;

  const pasukNum = parts.pop();
  const chapterNum = parts.pop();
  const bookName = parts
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return `${bookName} ${chapterNum}:${pasukNum}`;
}

export default function PasukSelect({
  rangePesukim,
  endPasukId,
  handleEndPasukChange,
  loadingPesukim = false,
}: PasukSelectProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(10);
  
  // 1. Ref to attach to the top-level container div
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedPasuk = rangePesukim?.find((p) => p.id === endPasukId);
  const visiblePesukim = rangePesukim?.slice(0, visibleCount) || [];

  // 2. Automatically close when clicking outside of this component
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    // Attach event listener when dropdown is mounted
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Clean up event listener when unmounted
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
    /* 3. Attach containerRef to the root wrapper div */
    <div ref={containerRef} className="relative w-full mt-2">
      <button
        type="button"
        disabled={loadingPesukim || rangePesukim?.length === 0}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2 text-left flex justify-between items-center"
      >
        <span>
          {selectedPasuk ? formatPasukId(selectedPasuk.ref) : 'Select Pasuk...'}
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
              onClick={() => {
                handleEndPasukChange(p.id);
                setIsOpen(false);
              }}
              className="cursor-pointer px-3 py-2 hover:bg-orange-50 text-sm"
            >
              {formatPasukId(p.ref)}
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