import '../css/Pagination.css';

export default function Pagination({ page, pageSize, totalItems, onPageChange }) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const firstItem = totalItems ? (page - 1) * pageSize + 1 : 0;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <nav className="pagination-controls" aria-label="Pagination">
      <span className="pagination-summary">
        {firstItem}-{lastItem} of {totalItems}
      </span>
      <div>
        <button
          type="button"
          aria-label="Previous page"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span aria-live="polite">Page {page} of {pageCount}</span>
        <button
          type="button"
          aria-label="Next page"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
