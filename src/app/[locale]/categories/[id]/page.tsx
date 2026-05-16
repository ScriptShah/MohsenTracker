import { redirect } from 'next/navigation';

export default function CategoryIdRedirect({
  params,
}: {
  params: { locale: string; id: string };
}) {
  redirect(`/${params.locale}/categories/detail?id=${params.id}`);
}
