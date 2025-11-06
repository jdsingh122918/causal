import { useState, useRef, useEffect, forwardRef } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  onSearch: (query: string) => void;
  onClear: () => void;
  placeholder?: string;
  value?: string;
  isLoading?: boolean;
  disabled?: boolean;
  suggestions?: string[];
  recentSearches?: string[];
  className?: string;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({
    onSearch,
    onClear,
    placeholder = "Search analyses with natural language...",
    value = "",
    isLoading = false,
    disabled = false,
    suggestions = [],
    recentSearches = [],
    className
  }, ref) => {
    const [query, setQuery] = useState(value);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Combine suggestions and recent searches
    const combinedSuggestions = [
      ...suggestions.slice(0, 3),
      ...(recentSearches.length > 0 ? ["---"] : []),
      ...recentSearches.slice(0, 3)
    ];

    useEffect(() => {
      setQuery(value);
    }, [value]);

    const handleSearch = (searchQuery?: string) => {
      const searchTerm = searchQuery || query.trim();
      if (searchTerm) {
        onSearch(searchTerm);
        setShowSuggestions(false);
      }
    };

    const handleClear = () => {
      setQuery("");
      onClear();
      setShowSuggestions(false);
      inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (focusedIndex >= 0 && combinedSuggestions[focusedIndex] !== "---") {
          handleSearch(combinedSuggestions[focusedIndex]);
        } else {
          handleSearch();
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        setFocusedIndex(-1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex(prev => {
          const validSuggestions = combinedSuggestions.filter(s => s !== "---");
          return Math.min(prev + 1, validSuggestions.length - 1);
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, -1));
      }
    };

    const handleSuggestionClick = (suggestion: string) => {
      if (suggestion !== "---") {
        handleSearch(suggestion);
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newQuery = e.target.value;
      setQuery(newQuery);
      setShowSuggestions(newQuery.length > 0);
      setFocusedIndex(-1);
    };

    const handleFocus = () => {
      if (query.length > 0 || combinedSuggestions.length > 0) {
        setShowSuggestions(true);
      }
    };

    const handleBlur = (e: React.FocusEvent) => {
      // Delay hiding suggestions to allow click events
      setTimeout(() => {
        if (!suggestionsRef.current?.contains(e.relatedTarget as Node)) {
          setShowSuggestions(false);
        }
      }, 150);
    };

    return (
      <div className={cn("relative w-full", className)}>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          <Input
            ref={ref || inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "pl-10 pr-10",
              query.length > 0 && "pr-20"
            )}
          />

          {query.length > 0 && (
            <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={disabled}
                className="h-6 w-6 p-0 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleSearch()}
                disabled={disabled || !query.trim()}
                className="h-6 w-6 p-0 hover:bg-muted"
              >
                <Search className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && combinedSuggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto"
          >
            {combinedSuggestions.map((suggestion, index) => {
              if (suggestion === "---") {
                return (
                  <div key={index} className="px-3 py-1">
                    <div className="text-xs text-muted-foreground font-medium">
                      Recent Searches
                    </div>
                  </div>
                );
              }

              const isRecent = recentSearches.includes(suggestion);
              const isFocused = focusedIndex === index;

              return (
                <div
                  key={index}
                  className={cn(
                    "px-3 py-2 cursor-pointer transition-colors text-sm",
                    isFocused
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted"
                  )}
                  onClick={() => handleSuggestionClick(suggestion)}
                  onMouseEnter={() => setFocusedIndex(index)}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{suggestion}</span>
                    {isRecent && (
                      <Badge variant="secondary" className="text-xs ml-2">
                        Recent
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

SearchBar.displayName = "SearchBar";