// Dummy data for Milestone 1 prototyping.
// This will be replaced with real API calls in Milestone 2.

export interface SignupSlot {
  id: string;
  name: string;
  quantity: number;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  capacity: number;
  signups: Participant[];
  slots: SignupSlot[];
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  signedUpAt: string;
}

export const dummyEvents: Event[] = [
  {
    id: '1',
    title: 'PTA Bake Sale',
    description: 'Annual bake sale fundraiser for Lincoln Elementary.',
    date: '2026-03-15',
    time: '10:00 AM',
    location: 'Lincoln Elementary Gym',
    capacity: 20,
    signups: [
      {
        id: 'p1',
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '555-0101',
        signedUpAt: '2026-02-10T14:30:00Z',
      },
      {
        id: 'p2',
        name: 'Bob Johnson',
        email: 'bob@example.com',
        signedUpAt: '2026-02-11T09:15:00Z',
      },
    ],
    slots: [
      { id: 's1', name: 'Bring cookies', quantity: 3 },
      { id: 's2', name: 'Bring napkins', quantity: 2 },
      { id: 's3', name: 'Help with setup', quantity: 4 },
    ],
  },
  {
    id: '2',
    title: 'Youth Soccer Practice',
    description: 'Weekly Saturday practice for U-12 team.',
    date: '2026-03-22',
    time: '9:00 AM',
    location: 'Riverside Park Field 3',
    capacity: 15,
    signups: [
      {
        id: 'p3',
        name: 'Maria Garcia',
        email: 'maria@example.com',
        phone: '555-0202',
        signedUpAt: '2026-02-12T11:00:00Z',
      },
    ],
    slots: [
      { id: 's4', name: 'Bring water bottles', quantity: 5 },
      { id: 's5', name: 'Bring orange slices', quantity: 2 },
    ],
  },
  {
    id: '3',
    title: 'Church Potluck Dinner',
    description: 'Monthly community potluck. Bring a dish to share!',
    date: '2026-04-05',
    time: '6:00 PM',
    location: 'Grace Community Church Hall',
    capacity: 50,
    signups: [],
    slots: [
      { id: 's6', name: 'Bring a main dish', quantity: 10 },
      { id: 's7', name: 'Bring a dessert', quantity: 8 },
      { id: 's8', name: 'Help with cleanup', quantity: 5 },
    ],
  },
];
