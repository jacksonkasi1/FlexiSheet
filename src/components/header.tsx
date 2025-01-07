"use client";

import { useTheme } from "next-themes"; // Handles theme switching

import Link from "next/link"; // For navigation links
import { usePathname } from "next/navigation"; // To determine the current path
import { Sun, Moon, Menu, X } from "lucide-react"; // Icons for theme and mobile menu
import { useState } from "react"; // For local state management
import { Button } from "@/components/ui/button"; // ShadCN button component

const Header = () => {
  const { theme, setTheme } = useTheme(); // Theme state and handler
  const pathname = usePathname(); // Current route path
  const [isMenuOpen, setIsMenuOpen] = useState(false); // State for mobile menu toggle

  // Navigation links
  const navigation = [
    { name: "Complex", href: "/" },
    { name: "Simple", href: "/normal" },
  ];

  // Toggle between light and dark themes
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link
              href="/"
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              FlexiSheet
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`${
                  pathname === item.href
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                } px-3 py-2 text-sm font-medium transition-colors`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Theme Toggle, ShadCN Button, and Mobile Menu Button */}
          <div className="flex items-center gap-4">
            {/* ShadCN Button for Theme Toggle */}
            <Button onClick={toggleTheme} variant="ghost" size="icon">
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            {/* Mobile Menu Toggle Button */}
            <Button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              variant="ghost"
              size="icon"
              className="md:hidden"
            >
              {isMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4">
            <div className="space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`${
                    pathname === item.href
                      ? "bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-blue-600 dark:hover:text-blue-400"
                  } block px-3 py-2 text-base font-medium transition-colors rounded-lg`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
