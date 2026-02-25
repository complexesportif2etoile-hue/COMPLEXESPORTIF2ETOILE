# Football Field Reservation System

A comprehensive football field reservation management application built with React, TypeScript, and Supabase.

## Features

- **User Authentication**: Secure login/signup with role-based access (Admin, Manager, Receptionist)
- **Dashboard**: Real-time statistics including available fields, revenue, and upcoming reservations
- **Field Management**: Create and manage football fields with pricing
- **Reservations**: Track and manage bookings with multiple status types
- **Payment Processing**: Support for multiple payment methods (Cash, Orange Money, Wave, Mixed)
- **Invoicing**: Generate and track invoices with VAT support
- **Activity Logging**: Comprehensive audit trail of all actions

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL database, Authentication, Row Level Security)
- **Icons**: Lucide React
- **Build Tool**: Vite

## Getting Started

1. The application is already configured with a Supabase database
2. Sign up for an account in the application
3. Start managing your football fields and reservations

## Default Roles

- **Admin**: Full system access
- **Manager**: Manage fields and reservations
- **Receptionist**: Handle day-to-day reservations and payments

## Database Schema

The system includes the following tables:
- `profiles`: User profiles with role-based permissions
- `terrains`: Football field information
- `reservations`: Booking records with client details
- `encaissements`: Payment transactions
- `factures`: Invoice generation
- `configuration`: System settings
- `historique_actions`: Activity audit log
