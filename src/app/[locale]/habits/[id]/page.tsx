import { redirect } from 'next/navigation';

export default function HabitIdRedirect({
  params,
}: {
  params: { locale: string; id: string };
}) {
  redirect(`/${params.locale}/habits/detail?id=${params.id}`);
}
