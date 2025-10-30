import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DoctorInputProps {
  doctors: string[];
  onAddDoctor: (name: string) => void;
  onRemoveDoctor: (index: number) => void;
  disabled?: boolean;
}

export function DoctorInput({ doctors, onAddDoctor, onRemoveDoctor, disabled = false }: DoctorInputProps) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) {
        onAddDoctor(inputValue.trim());
        setInputValue("");
      }
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="doctor-input">Doctors</Label>
        <div className="mt-2">
          <Input
            id="doctor-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type doctor name and press Enter..."
            data-testid="input-doctor"
            disabled={disabled}
          />
        </div>
      </div>

      {doctors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {doctors.map((doctor, index) => (
            <Badge
              key={index}
              variant="secondary"
              className="pl-3 pr-1 py-1.5"
              data-testid={`doctor-badge-${index}`}
            >
              <span className="mr-2">{doctor}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5 hover:bg-transparent"
                onClick={() => onRemoveDoctor(index)}
                data-testid={`button-remove-doctor-${index}`}
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
