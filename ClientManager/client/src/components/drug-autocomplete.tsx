import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DrugSuggestion {
  name: string;
  dosage?: string;
}

interface DrugAutocompleteProps {
  medications: { drugName: string; dosage?: string }[];
  onAddMedication: (drug: { drugName: string; dosage?: string }) => void;
  onRemoveMedication: (index: number) => void;
  disabled?: boolean;
}

export function DrugAutocomplete({ medications, onAddMedication, onRemoveMedication, disabled = false }: DrugAutocompleteProps) {
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<DrugSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputValue.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/drugs/search?q=${encodeURIComponent(inputValue)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
          setShowDropdown(data.length > 0);
        }
      } catch (error) {
        console.error("Failed to fetch drug suggestions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [inputValue]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectSuggestion = (suggestion: DrugSuggestion) => {
    onAddMedication({
      drugName: suggestion.name,
      dosage: suggestion.dosage,
    });
    setInputValue("");
    setSuggestions([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (inputValue.trim()) {
          onAddMedication({ drugName: inputValue.trim() });
          setInputValue("");
        }
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else if (inputValue.trim()) {
          onAddMedication({ drugName: inputValue.trim() });
          setInputValue("");
          setShowDropdown(false);
        }
        break;
      case "Escape":
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Label htmlFor="drug-input">Medications</Label>
        <div className="relative mt-2">
          <Input
            ref={inputRef}
            id="drug-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            placeholder="Start typing a medication name..."
            data-testid="input-drug-search"
            disabled={disabled}
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {showDropdown && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
            data-testid="drug-suggestions-dropdown"
          >
            <div className="max-h-60 overflow-auto p-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className={`w-full text-left px-3 py-2 rounded-sm text-sm ${
                    index === selectedIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover-elevate"
                  }`}
                  data-testid={`drug-suggestion-${index}`}
                >
                  <div className="font-medium">{suggestion.name}</div>
                  {suggestion.dosage && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {suggestion.dosage}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {medications.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {medications.map((med, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="pl-3 pr-1 py-1.5"
              data-testid={`medication-badge-${index}`}
            >
              <span className="mr-2">
                {med.drugName}
                {med.dosage && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({med.dosage})
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-transparent"
                onClick={() => onRemoveMedication(index)}
                data-testid={`button-remove-medication-${index}`}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
