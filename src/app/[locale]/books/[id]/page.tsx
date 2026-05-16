import { redirect } from 'next/navigation';

export default function BookIdRedirect({
  params,
}: {
  params: { locale: string; id: string };
}) {
  redirect(`/${params.locale}/books/detail?id=${params.id}`);
}
