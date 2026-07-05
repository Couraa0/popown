import React from 'react';

interface SummaryPanelProps {
  activeVideoId: string | null;
  summary: string;
  onGenerateSummary: () => void;
  isSummaryLoading: boolean;
  summaryFetched: boolean;
  seekTo: (seconds: number) => void;
}

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  activeVideoId,
  summary,
  onGenerateSummary,
  isSummaryLoading,
  summaryFetched,
  seekTo
}) => {
  const renderMessageText = (text: string) => {
    if (!text) return '';
    
    const postProcess = (str: string) => {
      return str.replace(/★/g, '*').replace(/＃/g, '#').replace(/＿/g, '_');
    };

    const segments = text.split(/<br\s*\/?>/gi);
    
    return segments.map((rawSegment, segIdx) => {
      const segment = rawSegment
        .replace(/\\\*/g, '★')
        .replace(/\\#/g, '＃')
        .replace(/\\_/g, '＿');

      const timeRegex = /\b(?:(\d+):)?(\d+):(\d+)\b/g;
      const parts: (string | React.ReactNode)[] = [];
      let lastIndex = 0;
      let match;

      while ((match = timeRegex.exec(segment)) !== null) {
        const matchIndex = match.index;
        
        if (matchIndex > lastIndex) {
          parts.push(segment.slice(lastIndex, matchIndex));
        }

        const matchStr = match[0];
        const hrs = match[1];
        const mins = match[2];
        const secs = match[3];
        
        let totalSeconds = 0;
        if (hrs) {
          totalSeconds = parseInt(hrs) * 3600 + parseInt(mins) * 60 + parseInt(secs);
        } else {
          totalSeconds = parseInt(mins) * 60 + parseInt(secs);
        }

        parts.push(
          <button
            key={`ts-${matchIndex}`}
            className="timestamp-link"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontWeight: '600',
              textDecoration: 'underline',
              cursor: 'pointer',
              padding: 0,
              font: 'inherit'
            }}
            onClick={(e) => {
              e.preventDefault();
              seekTo(totalSeconds);
            }}
          >
            {matchStr}
          </button>
        );

        lastIndex = timeRegex.lastIndex;
      }

      if (lastIndex < segment.length) {
        parts.push(segment.slice(lastIndex));
      }

      const parseInlineStyles = (content: string): React.ReactNode => {
        const boldRegex = /\*\*(.*?)\*\*/g;
        
        const parseItalic = (textStr: string): (string | React.ReactNode)[] => {
          const italicParts: (string | React.ReactNode)[] = [];
          let italicLastIndex = 0;
          let italicMatch;
          const styleRegex = /[\*_](.*?)[\*_]/g;
          
          while ((italicMatch = styleRegex.exec(textStr)) !== null) {
            if (italicMatch.index > italicLastIndex) {
              italicParts.push(postProcess(textStr.slice(italicLastIndex, italicMatch.index)));
            }
            italicParts.push(<em key={`em-${italicMatch.index}`}>{postProcess(italicMatch[1])}</em>);
            italicLastIndex = styleRegex.lastIndex;
          }
          if (italicLastIndex < textStr.length) {
            italicParts.push(postProcess(textStr.slice(italicLastIndex)));
          }
          return italicParts;
        };
        
        const parseBoldAndItalic = (textStr: string): React.ReactNode[] => {
          const boldParts: React.ReactNode[] = [];
          let boldLastIndex = 0;
          let boldMatch;
          
          while ((boldMatch = boldRegex.exec(textStr)) !== null) {
            if (boldMatch.index > boldLastIndex) {
              const subStr = textStr.slice(boldLastIndex, boldMatch.index);
              boldParts.push(...parseItalic(subStr));
            }
            boldParts.push(<strong key={`strong-${boldMatch.index}`}>{parseItalic(boldMatch[1])}</strong>);
            boldLastIndex = boldRegex.lastIndex;
          }
          if (boldLastIndex < textStr.length) {
            boldParts.push(...parseItalic(textStr.slice(boldLastIndex)));
          }
          return boldParts;
        };
        
        return <>{parseBoldAndItalic(content)}</>;
      };

      const renderedSegment = parts.map((part, i) => {
        if (typeof part === 'string') {
          return <span key={i}>{parseInlineStyles(part)}</span>;
        }
        return part;
      });

      if (segIdx < segments.length - 1) {
        return (
          <React.Fragment key={segIdx}>
            {renderedSegment}
            <br />
          </React.Fragment>
        );
      }
      return <React.Fragment key={segIdx}>{renderedSegment}</React.Fragment>;
    });
  };

  const parseMarkdownToReact = (mdText: string) => {
    if (!mdText) return null;
    const lines = mdText.split('\n');
    const listItems: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' | null = null;
    const elements: React.ReactNode[] = [];
    let tableRows: string[][] = [];

    const flushList = (key: string) => {
      if (listItems.length > 0) {
        if (listType === 'ul') {
          elements.push(
            <ul key={key} style={{ margin: '8px 0 8px 20px', paddingLeft: '0', listStyleType: 'disc' }}>
              {listItems.map((li, i) => <li key={i} style={{ marginBottom: '4px', paddingLeft: '2px' }}>{li}</li>)}
            </ul>
          );
        } else if (listType === 'ol') {
          elements.push(
            <ol key={key} style={{ margin: '8px 0 8px 20px', paddingLeft: '0', listStyleType: 'decimal' }}>
              {listItems.map((li, i) => <li key={i} style={{ marginBottom: '4px', paddingLeft: '2px' }}>{li}</li>)}
            </ol>
          );
        }
        listItems.length = 0;
        listType = null;
      }
    };

    const flushTable = (key: string) => {
      if (tableRows.length > 0) {
        const headers = tableRows[0];
        let dataRows = tableRows.slice(1);
        if (dataRows.length > 0 && dataRows[0].every(cell => cell.trim().match(/^-+$/))) {
          dataRows = dataRows.slice(1);
        }
        
        elements.push(
          <div key={key} className="table-responsive" style={{ overflowX: 'auto', margin: '16px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left', border: '1px solid var(--border-color)' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-accent-light)', borderBottom: '2px solid var(--accent-border)' }}>
                  {headers.map((h, i) => (
                    <th key={i} style={{ padding: '8px 10px', fontWeight: '600', color: 'var(--accent)' }}>
                      {renderMessageText(h.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: rIdx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>
                        {renderMessageText(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
    };

    lines.forEach((line, idx) => {
      const preprocessedLine = line
        .replace(/\\\*/g, '★')
        .replace(/\\#/g, '＃')
        .replace(/\\_/g, '＿');
      const cleanLine = preprocessedLine.trim();

      if (!cleanLine) {
        flushList(`list-end-${idx}`);
        flushTable(`table-end-${idx}`);
        return;
      }

      if (cleanLine === '---' || cleanLine === '***') {
        flushList(`list-hr-${idx}`);
        flushTable(`table-hr-${idx}`);
        elements.push(<hr key={idx} style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />);
        return;
      }

      if (cleanLine.startsWith('|')) {
        flushList(`list-tbl-${idx}`);
        const cells = cleanLine.split('|').slice(1, -1);
        tableRows.push(cells);
      } else {
        flushTable(`table-notbl-${idx}`);

        // Match bullet lists
        const ulMatch = cleanLine.match(/^[\-\*]\s+(.*)$/);
        // Match ordered lists
        const olMatch = cleanLine.match(/^(\d+)\.\s+(.*)$/);

        if (ulMatch) {
          if (listType !== 'ul') {
            flushList(`list-switch-ul-${idx}`);
            listType = 'ul';
          }
          listItems.push(renderMessageText(ulMatch[1]));
        } else if (olMatch) {
          if (listType !== 'ol') {
            flushList(`list-switch-ol-${idx}`);
            listType = 'ol';
          }
          listItems.push(renderMessageText(olMatch[2]));
        } else {
          flushList(`list-notlist-${idx}`);

          // Match headings (h1 to h6)
          const headingMatch = cleanLine.match(/^(#{1,6})\s+(.*)$/);
          if (headingMatch) {
            const level = headingMatch[1].length;
            const content = headingMatch[2];
            const Tag = level === 1 || level === 2 ? 'h2' : (level === 3 ? 'h3' : 'h4');
            elements.push(
              React.createElement(
                Tag,
                { key: idx },
                renderMessageText(content)
              )
            );
          } else {
            elements.push(<p key={idx} style={{ marginBottom: '8px', lineHeight: '1.5' }}>{renderMessageText(cleanLine)}</p>);
          }
        }
      }
    });

    flushList(`list-final`);
    flushTable(`table-final`);
    return elements;
  };

  return (
    <div className="emulator-panel active">
      <div className="tab-desc-bar">
        <span>Hasil ringkasan eksekutif video:</span>
        <button
          onClick={onGenerateSummary}
          className="btn btn-secondary btn-sm"
          disabled={!activeVideoId || isSummaryLoading}
        >
          {isSummaryLoading ? 'Meringkas...' : 'Buat Rangkuman'}
        </button>
      </div>
      <div className={`demo-summary-content ${!summaryFetched || !summary ? 'empty' : ''}`}>
        {isSummaryLoading ? (
          <div className="skeleton-container" style={{ width: '100%' }}>
            <div className="skeleton-line title"></div>
            <div className="skeleton-line"></div>
            <div className="skeleton-line short"></div>
          </div>
        ) : !summaryFetched ? (
          'Silakan analisis video dan tekan "Buat Rangkuman" untuk meringkas.'
        ) : (
          parseMarkdownToReact(summary)
        )}
      </div>
    </div>
  );
};
