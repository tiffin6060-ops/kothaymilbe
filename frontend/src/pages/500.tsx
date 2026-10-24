import ErrorPanel from "@/components/ErrorPanel";

export default function ServerError() {
  return <ErrorPanel message="দুঃখিত, কিছু একটা সমস্যা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।" showHomeLink />;
}
