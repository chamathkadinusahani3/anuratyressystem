import React from 'react';
import { Card } from '../ui/Card';
import { TrendingUp, Users, CalendarCheck, DollarSign } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
const data = [
{
  name: 'Mon',
  value: 40
},
{
  name: 'Tue',
  value: 30
},
{
  name: 'Wed',
  value: 60
},
{
  name: 'Thu',
  value: 45
},
{
  name: 'Fri',
  value: 80
},
{
  name: 'Sat',
  value: 95
},
{
  name: 'Sun',
  value: 70
}];

export function StatsCards() {
  const stats = [
  {
    label: 'Total Bookings',
    value: '1,284',
    change: '+12%',
    icon: CalendarCheck,
    color: '#FFD700'
  },
  {
    label: 'Revenue',
    value: '$42,500',
    change: '+8%',
    icon: DollarSign,
    color: '#10B981'
  },
  {
    label: 'Active Staff',
    value: '24',
    change: '0%',
    icon: Users,
    color: '#3B82F6'
  },
  {
    label: 'Popular Service',
    value: 'Wheel Align',
    change: '+24%',
    icon: TrendingUp,
    color: '#FF0000'
  }];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-neutral-400">
                  {stat.label}
                </p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  {stat.value}
                </h3>
              </div>
              <div
                className={`p-2 rounded-lg bg-neutral-800 text-[${stat.color}] group-hover:bg-neutral-700 transition-colors`}>

                <Icon
                  className="h-5 w-5"
                  style={{
                    color: stat.color
                  }} />

              </div>
            </div>

            <div className="flex items-center text-xs">
              <span
                className={
                stat.change.startsWith('+') ?
                'text-green-500' :
                'text-neutral-500'
                }>

                {stat.change}
              </span>
              <span className="text-neutral-500 ml-1">from last month</span>
            </div>

            {/* Mini Chart Background */}
            <div className="absolute bottom-0 left-0 right-0 h-12 opacity-10 group-hover:opacity-20 transition-opacity">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={stat.color}
                    fill={stat.color}
                    strokeWidth={2} />

                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>);

      })}
    </div>);

}