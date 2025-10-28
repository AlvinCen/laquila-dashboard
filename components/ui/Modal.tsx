import React from 'react';
import { Card, CardHeader, CardContent } from './Card';
import { Button } from './Button';
import { XIcon } from '../icons/XIcon';

interface ModalProps {
  title: string;
  isOpen?: boolean; // For future use if we want to control from outside
  onClose: () => void;
  children: React.ReactNode;
  size?: 'default' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({ title, onClose, children, size = 'default' }) => {
  const sizeClasses = {
      default: 'max-w-2xl',
      lg: 'max-w-4xl',
      xl: 'max-w-6xl'
  };

  return (
    <div 
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        aria-labelledby="modal-title"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
    >
      <div 
        className={`relative w-full ${sizeClasses[size]}`}
        onClick={e => e.stopPropagation()} // Prevent closing modal when clicking inside
      >
        <Card>
          <CardHeader className="flex justify-between items-center">
            <h2 id="modal-title" className="text-lg font-semibold">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close modal">
              <XIcon className="h-5 w-5" />
            </Button>
          </CardHeader>
          <CardContent>
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};