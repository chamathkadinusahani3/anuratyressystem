import React from 'react';
import { Card, CardHeader, CardTitle } from '../ui/Card';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Wrench, UserCog, HardHat } from 'lucide-react';
export function StaffAssignment() {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="w-5 h-5" />
          Assign Resources
        </CardTitle>
      </CardHeader>

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">Select Booking</span>
            <span className="text-[#FFD700] font-medium">BK-7830</span>
          </div>

          <Select
            label="Lead Mechanic"
            options={[
            {
              value: '',
              label: 'Select Mechanic...'
            },
            {
              value: 'm1',
              label: 'Saman Perera (Available)'
            },
            {
              value: 'm2',
              label: 'John Doe (Busy)'
            },
            {
              value: 'm3',
              label: 'Kasun Raj (Available)'
            }]
            } />


          <Select
            label="Tyre Technician"
            options={[
            {
              value: '',
              label: 'Select Technician...'
            },
            {
              value: 't1',
              label: 'Amal Silva'
            },
            {
              value: 't2',
              label: 'Ruwan Dias'
            }]
            } />


          <Select
            label="Equipment Bay"
            options={[
            {
              value: '',
              label: 'Select Bay...'
            },
            {
              value: 'b1',
              label: 'Bay 1 - Lift'
            },
            {
              value: 'b2',
              label: 'Bay 2 - Alignment'
            },
            {
              value: 'b3',
              label: 'Bay 3 - Tyre Change'
            }]
            } />

        </div>

        <div className="pt-4 border-t border-neutral-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-neutral-800 rounded-md">
              <Wrench className="w-4 h-4 text-[#FFD700]" />
            </div>
            <div className="text-xs text-neutral-400">
              <p className="text-white font-medium">Bay 2 Status</p>
              <p>Currently Free</p>
            </div>
          </div>

          <Button className="w-full" variant="primary">
            Assign & Notify Staff
          </Button>
        </div>
      </div>
    </Card>);

}