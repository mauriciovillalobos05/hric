import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.jsx";
import { Badge } from "@/components/ui/badge.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Textarea } from "@/components/ui/textarea.jsx";
import {
  Users,
  TrendingUp,
  Shield,
  Calendar,
  MessageSquare,
  FileText,
  Star,
  CheckCircle,
  ArrowRight,
  Building,
  Target,
  Zap,
  Globe,
  Menu,
  X,
} from "lucide-react";
import hricPoster from "../assets/hrcposter.png";
import "../App.css";

function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedUserType, setSelectedUserType] = useState("investor");
  const navigate = useNavigate();

  const handleNavigate = (role) => {
    if (role) {
      navigate(`/register?role=${role}`);
    } else {
      navigate("/register");
    }
  };

  const goToDashboard = (role) => {
    sessionStorage.setItem("role", role);
    navigate(`/dashboard/${role}`);
  };

  const handleSignIn = () => {
    navigate("/login");
  };

  const goToSelectPlan = (role) => {
    sessionStorage.setItem("registrationRole", role);
    navigate(`/select-plan?role=${role}`);
  };


  const features = [
    {
      icon: <Users className="h-8 w-8 text-blue-600" />,
      title: "AI-Powered Matching",
      description:
        "Sophisticated algorithms connect investors with startups based on compatibility, preferences, and success patterns.",
    },
    {
      icon: <Shield className="h-8 w-8 text-blue-600" />,
      title: "Secure Document Sharing",
      description:
        "Enterprise-grade security for pitch decks, financial statements, and confidential business documents.",
    },
    {
      icon: <MessageSquare className="h-8 w-8 text-blue-600" />,
      title: "Integrated Communication",
      description:
        "Built-in messaging, video calls, and collaboration tools for seamless investor-entrepreneur interactions.",
    },
    {
      icon: <Calendar className="h-8 w-8 text-blue-600" />,
      title: "Monthly Events",
      description:
        "Exclusive 'Shark Tank' style pitch events at Hyatt Residence with networking and investment opportunities.",
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-blue-600" />,
      title: "Portfolio Analytics",
      description:
        "Comprehensive tracking and analytics for investments, deal flow, and market insights.",
    },
    {
      icon: <FileText className="h-8 w-8 text-blue-600" />,
      title: "Due Diligence Tools",
      description:
        "AI-powered document analysis and collaborative due diligence workflows for informed decisions.",
    },
  ];

  const investorPlans = [
    {
      name: "Basic",
      price: "$50",
      period: "/month",
      description: "Perfect for casual investors exploring opportunities",
      features: [
        "Basic profile creation",
        "Startup browsing",
        "Limited matching (10/month)",
        "Basic messaging (50/month)",
        "Event notifications",
        "Document downloads (5/month)",
      ],
      popular: false,
    },
    {
      name: "Premium",
      price: "$150",
      period: "/month",
      description: "Ideal for active investors seeking quality deals",
      features: [
        "All Basic features",
        "Unlimited matching",
        "Advanced search filters",
        "Priority customer support",
        "Investment tracking tools",
        "Market insights reports",
        "Unlimited messaging & downloads",
      ],
      popular: true,
    },
    {
      name: "VIP",
      price: "$300",
      period: "/month",
      description: "Premium service for serious high-net-worth investors",
      features: [
        "All Premium features",
        "Personal investment advisor",
        "Exclusive deal access",
        "Free event attendance",
        "Custom matching criteria",
        "Direct founder introductions",
        "White-glove support",
      ],
      popular: false,
    },
  ];

  const entrepreneurPlans = [
    {
      name: "Free",
      price: "$0",
      period: "/month",
      description: "Get started with basic platform access",
      features: [
        "Basic profile creation",
        "Limited investor browsing",
        "Basic messaging",
        "3 matches per month",
        "3 document uploads",
        "Community access",
      ],
      popular: false,
    },
    {
      name: "Premium",
      price: "$75",
      period: "/month",
      description: "Full access for serious fundraising",
      features: [
        "Full profile creation",
        "Unlimited investor browsing",
        "Priority matching",
        "Analytics dashboard",
        "Pitch practice tools",
        "Unlimited uploads & matches",
      ],
      popular: true,
    },
    {
      name: "Enterprise",
      price: "$200",
      period: "/month",
      description: "Advanced features for established companies",
      features: [
        "All Premium features",
        "Dedicated success manager",
        "Custom branding",
        "API access",
        "White-label solutions",
        "Enterprise showcases",
      ],
      popular: false,
    },
  ];

  const testimonials = [
    {
      name: "Roberto Arechederra",
      role: "Former Secretary of Economic Development, Jalisco",
      content:
        "HRIC represents the future of investment in Guadalajara's innovation ecosystem. The platform's sophisticated approach to matching investors with entrepreneurs will accelerate our region's economic development.",
      avatar: "RA",
    },
    {
      name: "Maria González",
      role: "Angel Investor & Tech Executive",
      content:
        "The AI matching system helped me discover three portfolio companies that perfectly aligned with my investment thesis. The quality of entrepreneurs on HRIC is exceptional.",
      avatar: "MG",
    },
    {
      name: "Carlos Mendoza",
      role: "Founder, TechFlow AI",
      content:
        "Through HRIC, we connected with investors who not only provided capital but became strategic advisors. The platform's focus on relationship quality sets it apart.",
      avatar: "CM",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">HRIC</h1>
                <p className="text-xs text-gray-600">
                  Hyatt Residence Investment Club
                </p>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-8">
                <a
                  href="#features"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                >
                  Features
                </a>
                <a
                  href="#pricing"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                >
                  Pricing
                </a>
                <a
                  href="#events"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                >
                  Events
                </a>
                <a
                  href="#about"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                >
                  About
                </a>
              </div>
            </div>
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
              >
                {isMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t">
              <a
                href="#features"
                className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600"
              >
                Pricing
              </a>
              <a
                href="#events"
                className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600"
              >
                Events
              </a>
              <a
                href="#about"
                className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-blue-600"
              >
                About
              </a>
              <div className="px-3 py-2 space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSignIn}
                >
                  Sign In
                </Button>
                <Button className="w-full" onClick={() => handleNavigate()}>
                  Get Started
                </Button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                Shark Tank para Guadalajara
              </Badge>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                Connect Capital with
                <span className="text-blue-600"> Innovation</span>
              </h1>
              <p className="text-xl text-gray-600 leading-relaxed">
                The premier AI-powered investment platform connecting qualified
                investors with Mexico's most promising startups. Join
                Guadalajara's exclusive investment community at Hyatt Residence.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="text-lg px-8 py-4"
                  onClick={() => goToSelectPlan("investor")}
                >
                  Join as Investor
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-4"
                  onClick={() => goToSelectPlan("entrepreneur")}
                >
                  Apply as Entrepreneur
                </Button>

              </div>
            </div>
            <div className="relative">
              <div className="relative z-10">
                <img
                  src={hricPoster}
                  alt="HRIC Investment Club Poster"
                  className="w-full max-w-md mx-auto rounded-2xl shadow-2xl"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl blur-3xl opacity-20 transform rotate-6"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-gray-900">
              Platform Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Sophisticated technology meets exclusive networking to create
              Mexico's premier investment ecosystem
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300"
              >
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-3 bg-blue-50 rounded-full w-fit">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-center">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        className="py-24 bg-gradient-to-br from-slate-50 to-blue-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-gray-900">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-600">
              Flexible pricing for investors and entrepreneurs at every stage
            </p>

            {/* User Type Toggle */}
            <div className="flex justify-center mt-8">
              <div className="bg-white p-1 rounded-lg border">
                <Button
                  variant={
                    selectedUserType === "investor" ? "default" : "ghost"
                  }
                  onClick={() => setSelectedUserType("investor")}
                  className="px-6"
                >
                  <Building className="mr-2 h-4 w-4" />
                  Investors
                </Button>
                <Button
                  variant={
                    selectedUserType === "entrepreneur" ? "default" : "ghost"
                  }
                  onClick={() => setSelectedUserType("entrepreneur")}
                  className="px-6"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Entrepreneurs
                </Button>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {(selectedUserType === "investor"
              ? investorPlans
              : entrepreneurPlans
            ).map((plan, index) => (
              <Card
                key={index}
                className={`relative ${plan.popular
                    ? "border-blue-500 border-2 shadow-xl"
                    : "border-gray-200"
                  }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">
                      {plan.price}
                    </span>
                    <span className="text-gray-600">{plan.period}</span>
                  </div>
                  <CardDescription className="mt-4">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li
                        key={featureIndex}
                        className="flex items-center space-x-3"
                      >
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full ${plan.popular ? "bg-blue-600 hover:bg-blue-700" : ""
                      }`}
                  >
                    {plan.price === "$0" ? "Get Started Free" : "Choose Plan"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Events Section */}
      <section id="events" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold text-gray-900">
                Monthly Investment Events
              </h2>
              <p className="text-xl text-gray-600">
                Experience "Shark Tank for Guadalajara" at our exclusive monthly
                events held at Hyatt Residence. Connect with investors, watch
                live pitches, and participate in real investment decisions.
              </p>

              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Calendar className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      Second Thursday Each Month
                    </h3>
                    <p className="text-gray-600">
                      6:30 PM - 8:30 PM at Hyatt Residence Main Lounge
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Exclusive Networking</h3>
                    <p className="text-gray-600">
                      Connect with 25-50 select investors and entrepreneurs
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Target className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Live Pitch Sessions</h3>
                    <p className="text-gray-600">
                      3 carefully selected startups pitch for 20 minutes each
                    </p>
                  </div>
                </div>
              </div>

              <Button size="lg" className="mt-6">
                Register for Next Event
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-6">Enterprise Showcase</h3>
              <p className="text-blue-100 mb-6">
                Premium presentation slots for established companies seeking
                significant investment. 45-minute dedicated sessions with
                professional videography and investor networking.
              </p>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span>Presentation Time:</span>
                  <span className="font-semibold">45 minutes</span>
                </div>
                <div className="flex justify-between">
                  <span>Investment Focus:</span>
                  <span className="font-semibold">$500K+ rounds</span>
                </div>
                <div className="flex justify-between">
                  <span>Showcase Fee:</span>
                  <span className="font-semibold">$1,500</span>
                </div>
              </div>

              <Button variant="secondary" className="w-full">
                Apply for Showcase
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-4xl font-bold text-gray-900">
              What Our Community Says
            </h2>
            <p className="text-xl text-gray-600">
              Trusted by investors and entrepreneurs across Guadalajara
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="h-5 w-5 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 italic">
                    "{testimonial.content}"
                  </p>
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {testimonial.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Join Mexico's Premier Investment Community?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Connect with qualified investors and promising entrepreneurs in
            Guadalajara's most exclusive investment club.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="secondary"
              className="text-lg px-8 py-4"
              onClick={() => goToSelectPlan("investor")}
            >
              <Building className="mr-2 h-5 w-5" />
              Join as Investor
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-4 border-white hover:bg-white hover:text-blue-600"
              onClick={() => goToSelectPlan("entrepreneur")}
            >
              <Zap className="mr-2 h-5 w-5" />
              Apply as Entrepreneur
            </Button>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold">HRIC</h3>
              <p className="text-gray-400">
                Hyatt Residence Investment Club - Connecting capital with
                innovation in Mexico's Silicon Valley.
              </p>
              <div className="flex space-x-4">
                <Globe className="h-5 w-5 text-gray-400" />
                <span className="text-gray-400">Guadalajara, Mexico</span>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Security
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    API
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Community</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Events
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Success Stories
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Partners
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>
              &copy; 2025 HRIC - Hyatt Residence Investment Club. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
