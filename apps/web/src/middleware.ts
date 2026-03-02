import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/lesson/:path*",
    "/homework/:path*",
    "/vocabulary/:path*",
    "/progress/:path*",
    "/settings/:path*",
  ],
};
