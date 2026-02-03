import { PrismaClient } from '@prisma/client';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWeekend,
  getDay,
  format,
  getWeek,
  startOfWeek,
  endOfWeek,
} from 'date-fns';

const prisma = new PrismaClient();

// Commission tier calculation
function getCommissionTier(percent: number) {
  if (percent >= 150) return { tier: 'PLATINUM', bonus: 0.15 };
  if (percent >= 120) return { tier: 'GOLD', bonus: 0.10 };
  if (percent >= 110) return { tier: 'SILVER', bonus: 0.05 };
  if (percent >= 100) return { tier: 'BRONZE', bonus: 0.02 };
  return { tier: 'NONE', bonus: 0 };
}

async function seedEODRData() {
  console.log('🌱 Starting EODR seed...');

  // Get all users
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true, role: true },
  });

  if (users.length === 0) {
    console.log('❌ No users found. Please run the main seed first.');
    return;
  }

  console.log(`📋 Found ${users.length} users`);

  // Get admin for creating holidays
  const admin = users.find(u => u.role === 'ADMIN');
  if (!admin) {
    console.log('❌ No admin user found.');
    return;
  }

  // Use January 2026 (past month with complete data)
  const year = 2026;
  const month = 1;
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const today = new Date();
  today.setHours(23, 59, 59, 999); // Include today

  console.log(`📅 Seeding data for ${format(monthStart, 'MMMM yyyy')}`);

  // Step 1: Create Holidays
  console.log('\n🎄 Creating holidays...');

  const holidays = [
    { date: new Date(2026, 0, 1), name: "New Year's Day", type: 'FULL' as const },
    { date: new Date(2026, 0, 26), name: 'Republic Day', type: 'FULL' as const },
    { date: new Date(2026, 0, 15), name: 'Makar Sankranti', type: 'HALF' as const },
  ];

  for (const holiday of holidays) {
    await prisma.holiday.upsert({
      where: { date: holiday.date },
      update: { name: holiday.name, type: holiday.type },
      create: {
        date: holiday.date,
        name: holiday.name,
        type: holiday.type,
        year,
        month,
        createdById: admin.id,
      },
    });
  }
  console.log(`✅ ${holidays.length} holidays created`);

  // Step 2: Calculate working days (only up to today, not future)
  const effectiveEnd = monthEnd < today ? monthEnd : today;
  const allDays = eachDayOfInterval({ start: monthStart, end: effectiveEnd });
  const holidayDates = holidays.map(h => format(h.date, 'yyyy-MM-dd'));
  const halfDayDates = holidays.filter(h => h.type === 'HALF').map(h => format(h.date, 'yyyy-MM-dd'));

  let workingDays = 0;
  const workingDaysList: Date[] = [];

  for (const day of allDays) {
    if (isWeekend(day)) continue;
    const dateStr = format(day, 'yyyy-MM-dd');

    const fullHoliday = holidays.find(h => format(h.date, 'yyyy-MM-dd') === dateStr && h.type === 'FULL');
    if (fullHoliday) continue;

    const halfHoliday = holidays.find(h => format(h.date, 'yyyy-MM-dd') === dateStr && h.type === 'HALF');
    if (halfHoliday) {
      workingDays += 0.5;
    } else {
      workingDays += 1;
    }
    workingDaysList.push(day);
  }

  console.log(`📊 Working days: ${workingDays}`);

  // Step 3: Create Daily EODR entries for each user
  console.log('\n📝 Creating daily EODR entries...');

  // Performance profiles for different users (to create variety)
  const performanceProfiles: Record<string, { min: number; max: number; label: string }> = {
    'platinum': { min: 10, max: 12, label: 'Star performer' },      // 150%+ (10-12 hours = 3.3-4 tasks)
    'gold': { min: 8, max: 10, label: 'High performer' },           // 120%+ (8-10 hours = 2.6-3.3 tasks)
    'silver': { min: 7, max: 9, label: 'Good performer' },          // 110%+ (7-9 hours = 2.3-3 tasks)
    'bronze': { min: 6, max: 8, label: 'Meeting target' },          // 100%+ (6-8 hours = 2-2.6 tasks)
    'developing': { min: 4, max: 6, label: 'Needs improvement' },   // <100% (4-6 hours = 1.3-2 tasks)
  };

  // Assign profiles to users
  const profileAssignments = ['platinum', 'gold', 'silver', 'bronze', 'developing'];

  const taskNames = [
    'API Development', 'Bug Fixing', 'Code Review', 'Documentation',
    'Feature Implementation', 'Testing', 'Database Migration', 'UI Development',
    'Performance Optimization', 'Security Audit', 'Client Meeting', 'Sprint Planning'
  ];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const profileKey = profileAssignments[i % profileAssignments.length];
    const profile = performanceProfiles[profileKey];

    console.log(`  Creating entries for ${user.name} (${profile.label})...`);

    for (const day of workingDaysList) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const isHalfDay = halfDayDates.includes(dateStr);

      // Random hours within profile range (halved for half days)
      const baseHours = profile.min + Math.random() * (profile.max - profile.min);
      const totalHoursLogged = isHalfDay ? baseHours / 2 : baseHours;
      const taskEquivalent = totalHoursLogged / 3;

      // Generate task details
      const numTasks = Math.floor(Math.random() * 3) + 2; // 2-4 tasks
      const taskDetails = [];
      let remainingHours = totalHoursLogged;

      for (let t = 0; t < numTasks; t++) {
        const isLast = t === numTasks - 1;
        const timeSpent = isLast ? remainingHours : Math.min(remainingHours * 0.4, remainingHours);
        remainingHours -= timeSpent;

        taskDetails.push({
          taskName: taskNames[Math.floor(Math.random() * taskNames.length)],
          timeSpent: Math.round(timeSpent * 10) / 10,
          status: Math.random() > 0.1 ? 'COMPLETED' : 'IN_PROGRESS',
        });
      }

      const dailyTarget = isHalfDay ? 1.5 : 3;

      await prisma.dailyEODR.upsert({
        where: { userId_date: { userId: user.id, date: new Date(dateStr) } },
        update: {
          tasksAssigned: dailyTarget,
          tasksCompleted: Math.round(taskEquivalent * 10) / 10,
          taskDetails,
          totalHoursLogged: Math.round(totalHoursLogged * 10) / 10,
          taskEquivalent: Math.round(taskEquivalent * 100) / 100,
          finalCount: Math.round(taskEquivalent * 10) / 10,
          isHalfDay,
          status: 'VERIFIED',
          verifiedById: admin.id,
          verifiedAt: new Date(),
        },
        create: {
          userId: user.id,
          date: new Date(dateStr),
          tasksAssigned: dailyTarget,
          tasksCompleted: Math.round(taskEquivalent * 10) / 10,
          taskDetails,
          totalHoursLogged: Math.round(totalHoursLogged * 10) / 10,
          taskEquivalent: Math.round(taskEquivalent * 100) / 100,
          finalCount: Math.round(taskEquivalent * 10) / 10,
          isHalfDay,
          isHoliday: false,
          status: 'VERIFIED',
          verifiedById: admin.id,
          verifiedAt: new Date(),
          employeeComments: Math.random() > 0.7 ? 'Good progress today' : null,
        },
      });
    }
  }
  console.log(`✅ Daily EODR entries created for ${users.length} users`);

  // Step 4: Calculate and create weekly summaries
  console.log('\n📊 Creating weekly summaries...');

  // Get all weeks in the month
  const weeks = new Map<number, { start: Date; end: Date; days: Date[] }>();

  for (const day of workingDaysList) {
    const weekNum = getWeek(day, { weekStartsOn: 1 });
    if (!weeks.has(weekNum)) {
      weeks.set(weekNum, {
        start: startOfWeek(day, { weekStartsOn: 1 }),
        end: endOfWeek(day, { weekStartsOn: 1 }),
        days: [],
      });
    }
    weeks.get(weekNum)!.days.push(day);
  }

  for (const user of users) {
    for (const [weekNum, weekData] of weeks) {
      // Get daily entries for this week
      const dailyEntries = await prisma.dailyEODR.findMany({
        where: {
          userId: user.id,
          date: {
            gte: weekData.start,
            lte: weekData.end,
          },
        },
      });

      const tasksCompleted = dailyEntries.reduce((sum, e) => sum + e.tasksCompleted, 0);
      const tasksAssigned = dailyEntries.reduce((sum, e) => sum + e.tasksAssigned, 0);

      // Calculate working days in this week (accounting for half days)
      let weekWorkingDays = 0;
      for (const day of weekData.days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (halfDayDates.includes(dateStr)) {
          weekWorkingDays += 0.5;
        } else {
          weekWorkingDays += 1;
        }
      }

      const weeklyTarget = weekWorkingDays * 3;
      const completionRate = weeklyTarget > 0 ? (tasksCompleted / weeklyTarget) * 100 : 0;

      await prisma.weeklyEODRSummary.upsert({
        where: { userId_weekNumber_month_year: { userId: user.id, weekNumber: weekNum, month, year } },
        update: {
          tasksAssigned: Math.round(tasksAssigned * 10) / 10,
          tasksCompleted: Math.round(tasksCompleted * 10) / 10,
          weeklyTarget: Math.round(weeklyTarget * 10) / 10,
          completionRate: Math.round(completionRate * 10) / 10,
        },
        create: {
          userId: user.id,
          weekNumber: weekNum,
          month,
          year,
          startDate: weekData.start,
          endDate: weekData.end,
          tasksAssigned: Math.round(tasksAssigned * 10) / 10,
          tasksCompleted: Math.round(tasksCompleted * 10) / 10,
          weeklyTarget: Math.round(weeklyTarget * 10) / 10,
          completionRate: Math.round(completionRate * 10) / 10,
        },
      });
    }
  }
  console.log(`✅ Weekly summaries created`);

  // Step 5: Calculate and create monthly summaries with commission
  console.log('\n💰 Creating monthly summaries with commission...');

  const monthlyTarget = workingDays * 3;

  for (const user of users) {
    // Get all daily entries for the month
    const dailyEntries = await prisma.dailyEODR.findMany({
      where: {
        userId: user.id,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const tasksCompleted = dailyEntries.reduce((sum, e) => sum + e.tasksCompleted, 0);
    const totalHoursLogged = dailyEntries.reduce((sum, e) => sum + e.totalHoursLogged, 0);
    const taskEquivalent = dailyEntries.reduce((sum, e) => sum + e.taskEquivalent, 0);
    const completionPercent = monthlyTarget > 0 ? (tasksCompleted / monthlyTarget) * 100 : 0;

    const { tier, bonus } = getCommissionTier(completionPercent);

    await prisma.monthlyEODRSummary.upsert({
      where: { userId_month_year: { userId: user.id, month, year } },
      update: {
        totalWorkingDays: Math.round(workingDays),
        taskTarget: Math.round(monthlyTarget * 10) / 10,
        tasksCompleted: Math.round(tasksCompleted * 10) / 10,
        totalHoursLogged: Math.round(totalHoursLogged * 10) / 10,
        taskEquivalent: Math.round(taskEquivalent * 100) / 100,
        completionPercent: Math.round(completionPercent * 10) / 10,
        commissionTier: tier,
        commissionPercent: bonus * 100,
      },
      create: {
        userId: user.id,
        month,
        year,
        totalWorkingDays: Math.round(workingDays),
        taskTarget: Math.round(monthlyTarget * 10) / 10,
        tasksCompleted: Math.round(tasksCompleted * 10) / 10,
        totalHoursLogged: Math.round(totalHoursLogged * 10) / 10,
        taskEquivalent: Math.round(taskEquivalent * 100) / 100,
        completionPercent: Math.round(completionPercent * 10) / 10,
        commissionTier: tier,
        commissionPercent: bonus * 100,
        isFinalized: false,
      },
    });

    console.log(`  ${user.name}: ${Math.round(completionPercent)}% completion -> ${tier} (${bonus * 100}% commission)`);
  }

  console.log('\n🎉 EODR seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   Month: January 2026`);
  console.log(`   Working days: ${workingDays}`);
  console.log(`   Monthly target: ${monthlyTarget} tasks`);
  console.log(`   Holidays: ${holidays.length}`);
  console.log(`   Users seeded: ${users.length}`);
}

seedEODRData()
  .catch((e) => {
    console.error('❌ EODR seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
