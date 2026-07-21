import React from 'react';
import './Pagination.css';

interface PaginationProps {
  page: number;
  totalPages: number;
  setPage: (page: number | ((prev: number) => number)) => void;
}

const Pagination: React.FC<PaginationProps> = ({ page, totalPages, setPage }) => {
  if (totalPages <= 1) return null;

  // Generate page numbers
  const pages = [];
  const maxVisiblePages = 5;
  
  let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
  let endPage = startPage + maxVisiblePages - 1;
  
  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="pagination">
      <button
        className="pagination-btn"
        onClick={() => setPage((p: number) => Math.max(1, p - 1))}
        disabled={page === 1}
      >
        Previous
      </button>
      
      <div className="pagination-numbers">
        {startPage > 1 && (
          <>
            <button className="pagination-btn num" onClick={() => setPage(1)}>1</button>
            {startPage > 2 && <span className="pagination-dots">...</span>}
          </>
        )}
        
        {pages.map(p => (
          <button
            key={p}
            className={`pagination-btn num ${p === page ? 'active' : ''}`}
            onClick={() => setPage(p)}
          >
            {p}
          </button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="pagination-dots">...</span>}
            <button className="pagination-btn num" onClick={() => setPage(totalPages)}>{totalPages}</button>
          </>
        )}
      </div>

      <button
        className="pagination-btn"
        onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
        disabled={page === totalPages}
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;
