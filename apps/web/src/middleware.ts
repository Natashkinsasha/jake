import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/prototype/:path*",
    "/dashboard/:path*",
    "/lesson/:path*",
    "/lessons/:path*",
    "/homework/:path*",
    "/vocabulary/:path*",
    "/progress/:path*",
    "/settings/:path*",
  ],
};
