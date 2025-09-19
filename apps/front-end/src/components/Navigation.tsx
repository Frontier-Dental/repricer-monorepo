"use client";

import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold">Repricer v2</span>
            </Link>

            <div className="flex items-center space-x-2">
              <Link to="/">
                <Button
                  variant={isActive("/") ? "default" : "ghost"}
                  className="h-9"
                >
                  Products
                </Button>
              </Link>

              <Link to="/errors">
                <Button
                  variant={isActive("/errors") ? "default" : "ghost"}
                  className="h-9"
                >
                  Unhandled Errors
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/")}
              className="h-9"
            >
              Back To Main App
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
